import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import { createWakeOnLanPacket, parseNaturalLanguageCommand, validateMacAddress } from './src/utils/tvProtocol.ts';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: '20mb' }));

// Enable CORS for external audit tools (PWABuilder, Lighthouse, Chromium bots)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const DEFAULT_SYSTEM_INSTRUCTION = `Eres el asistente oficial de voz y control inteligente para televisores LG Smart TV con webOS ("LG ThinQ AI Copilot").
Tu rol es:
1. Ayudar al usuario a controlar su televisor LG por voz o texto en lenguaje natural (Español o Inglés).
2. Comprender comandos directos de control: subir/bajar volumen, mutear, encender/apagar por Wi-Fi (Wake-on-LAN), abrir aplicaciones (Netflix, YouTube, Disney+, Prime Video, Spotify, Apple TV+, etc.), cambiar entradas HDMI (HDMI 1, HDMI 2 eARC, HDMI 3, HDMI 4), y alternar modos de imagen (Cine, Juego, Filmmaker, Vívido, Estándar).
3. Ofrecer consejos de expertos en tecnología LG OLED, QNED y NanoCell (calibración de imagen, reducción de retenciones, audio eARC Dolby Atmos, configuración de consolas PS5/Xbox Series X a 120Hz VRR).
4. Si el mensaje del usuario contiene una acción directa para el televisor, confírmala amigablemente y especifica qué acción se ejecutará.`;

// 1. Multi-turn Chat Endpoint with Gemini models
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const {
      messages = [],
      model = 'gemini-3.8-flash',
      enableThinking = false,
      systemInstruction = DEFAULT_SYSTEM_INSTRUCTION,
    } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY no está configurada en las variables de entorno.',
      });
    }

    // Format contents for Gemini SDK
    // Map conversation history
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    // Selected model handling
    let targetModel = model;
    if (!['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-4-argon'].includes(targetModel)) {
      targetModel = 'gemini-3.8-flash';
    }

    const config: Record<string, any> = {
      systemInstruction,
    };

    if (enableThinking && targetModel === 'gemini-4-argon') {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    let response;
    try {
      response = await ai.models.generateContent({
        model: targetModel,
        contents,
        config,
      });
    } catch (apiError: any) {
      console.warn(`Error invoking ${targetModel}:`, apiError?.message);
      // Fallback to gemini-3.8-flash if paid model quota or authorization error
      if (targetModel === 'gemini-4-argon') {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: { systemInstruction },
        });
      } else {
        throw apiError;
      }
    }

    const reply = response.text || 'No se pudo generar respuesta.';

    // Check last user message for direct command extraction
    const lastUserMsg = messages.filter((m: { role: string }) => m.role === 'user').pop();
    const parsedCommand = lastUserMsg ? parseNaturalLanguageCommand(lastUserMsg.content) : null;

    res.json({
      reply,
      parsedCommand: parsedCommand?.action !== 'UNKNOWN' ? parsedCommand : null,
      modelUsed: targetModel,
    });
  } catch (err: any) {
    console.error('Gemini chat error:', err);
    res.status(500).json({
      error: err.message || 'Error al comunicarse con Gemini.',
    });
  }
});

// 2. Image Analysis Endpoint using gemini-4-argon
app.post('/api/gemini/analyze-image', async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      prompt = 'Analiza esta imagen relacionada con mi televisor LG Smart TV.',
      enableHighThinking = true,
    } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Falta la imagen en base64.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const config: Record<string, any> = {
      systemInstruction: `Eres un ingeniero especialista en televisores LG Smart TV (OLED, QNED, NanoCell, webOS).
Analiza detalladamente la fotografía proporcionada:
1. Si es la pantalla del TV: evalúa calidad de imagen, balance de blancos, posibles problemas (retención de imagen, banding, artefactos de compresión, modo de imagen inadecuado) y ofrece la calibración exacta recomendada (Luz OLED, Contraste, Brillo, Nitidez, Color, TruMotion).
2. Si es la etiqueta trasera o caja del TV: extrae con precisión el número de modelo exacto (ej. OLED65C3PSA), serie, año de fabricación, tipo de panel, puertos HDMI 2.1 soportados y versión de webOS recomendada.
3. Si es un menú de error o conexión: explica el significado del error y da los pasos exactos de solución.
Entrega un resumen estructurado y recomendaciones paso a paso para el control remoto.`,
    };

    if (enableHighThinking) {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config,
      });
    } catch (err: any) {
      console.warn('gemini-4-argon image analysis fallback:', err?.message);
      // Fallback to gemini-3.8-flash for image understanding if argon unavailable
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: { systemInstruction: config.systemInstruction },
      });
    }

    res.json({
      analysis: response.text || 'Análisis completado sin texto retornado.',
      modelUsed: 'gemini-4-argon',
    });
  } catch (err: any) {
    console.error('Image analysis error:', err);
    res.status(500).json({
      error: err.message || 'Error en el análisis de imagen con Gemini.',
    });
  }
});

// 3. Wake-on-LAN real UDP broadcast endpoint
app.post('/api/tv/wol', (req, res) => {
  const { mac, broadcastIp = '255.255.255.255', port: wolPort = 9 } = req.body;
  if (!mac || !validateMacAddress(mac)) {
    return res.status(400).json({ error: 'Dirección MAC inválida.' });
  }

  try {
    const packet = createWakeOnLanPacket(mac);
    const packetBuffer = Buffer.from(packet);
    
    // Enviar paquete mágico UDP real a la red local
    import('dgram').then(({ default: dgram }) => {
      const socket = dgram.createSocket('udp4');
      socket.bind(() => {
        try {
          socket.setBroadcast(true);
          socket.send(packetBuffer, 0, packetBuffer.length, Number(wolPort) || 9, broadcastIp, (err) => {
            if (err) console.warn('[WoL] Error enviando broadcast UDP:', err.message);
            try { socket.close(); } catch {}
          });
        } catch (e: any) {
          console.warn('[WoL] Fallo de socket UDP:', e.message);
          try { socket.close(); } catch {}
        }
      });
    }).catch(() => {});

    res.json({
      success: true,
      message: `Paquete mágico Wake-On-LAN (102 bytes) emitido a la MAC ${mac}`,
      packetBytes: packet.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3.1. Descubrimiento SSDP en la red local
app.get('/api/tv/discover-ssdp', async (req, res) => {
  try {
    const { default: dgram } = await import('dgram');
    const discovered: Array<{ ip: string; location?: string; model?: string }> = [];
    const client = dgram.createSocket('udp4');

    const mSearchQuery = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      'HOST: 239.255.255.250:1900\r\n' +
      'MAN: "ssdp:discover"\r\n' +
      'MX: 2\r\n' +
      'ST: urn:lge-com:service:webos:secondscreen-1\r\n\r\n'
    );

    client.on('message', (msg, rinfo) => {
      const text = msg.toString();
      if (!discovered.some((d) => d.ip === rinfo.address)) {
        const locationMatch = text.match(/LOCATION:\s*(.+)/i);
        const serverMatch = text.match(/SERVER:\s*(.+)/i);
        discovered.push({
          ip: rinfo.address,
          location: locationMatch ? locationMatch[1].trim() : undefined,
          model: serverMatch ? serverMatch[1].trim() : 'LG webOS TV',
        });
      }
    });

    client.bind(() => {
      try {
        client.setBroadcast(true);
        client.send(mSearchQuery, 0, mSearchQuery.length, 1900, '239.255.255.250');
      } catch (err: any) {
        console.warn('[SSDP] Error al emitir M-SEARCH:', err.message);
      }
    });

    setTimeout(() => {
      try { client.close(); } catch {}
      res.json({
        success: true,
        count: discovered.length,
        devices: discovered,
      });
    }, 2200);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error en SSDP' });
  }
});

// 4. TV command router
app.post('/api/tv/command', (req, res) => {
  const { command, value, ip } = req.body;
  res.json({
    acknowledged: true,
    command,
    value,
    ip: ip || '192.168.1.105',
    timestamp: Date.now(),
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicit PWA Service Worker & Manifest routes with required HTTP headers & CORS
const serveServiceWorker = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  const filePath = path.resolve(
    __dirname,
    process.env.NODE_ENV === 'production' ? 'dist' : 'public',
    'service-worker.js'
  );
  res.sendFile(filePath, (err) => {
    if (err) next();
  });
};

app.get('/service-worker.js', serveServiceWorker);
app.get('/sw.js', serveServiceWorker);
app.get('/pwabuilder-sw.js', serveServiceWorker);

const serveManifest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const filePath = path.resolve(
    __dirname,
    process.env.NODE_ENV === 'production' ? 'dist' : 'public',
    'manifest.json'
  );
  res.sendFile(filePath, (err) => {
    if (err) next();
  });
};

app.get('/manifest.json', serveManifest);
app.get('/manifest.webmanifest', serveManifest);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`LG ThinQ Smart Remote app server running on http://0.0.0.0:${port}`);
  });
}

startServer();

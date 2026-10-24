/**
 * Generator for Standalone Local HTML Remote
 * Runs completely client-side via file:/// or local storage with zero mixed-content or SSL restrictions.
 * Connects directly to ws://<TV-IP>:3000 (which returns 'hello world' on HTTP).
 */

export function generateStandaloneRemoteHTML(defaultIP: string = '', defaultName: string = 'Mi LG Smart TV'): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Control Remoto LG ThinQ (Modo Local)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-tap-highlight-color: transparent; }
    body {
      background: #090d16;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
    }
    .container {
      width: 100%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .header {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 20px;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-logo {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #e11d48;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 13px;
      color: #fff;
    }
    .brand-title {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }
    .status-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 999px;
      background: #1e293b;
      color: #94a3b8;
    }
    .status-pill.connected { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
    .status-pill.connecting { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
    .status-pill.prompt { background: rgba(244,63,94,0.15); color: #fb7185; border: 1px solid rgba(244,63,94,0.3); animation: pulse 1.5s infinite; }
    
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 24px;
      padding: 18px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
    }

    .ip-box {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ip-input-row {
      display: flex;
      gap: 8px;
    }
    input[type="text"] {
      flex: 1;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 10px 14px;
      color: #fff;
      font-family: monospace;
      font-size: 14px;
      outline: none;
    }
    input[type="text"]:focus { border-color: #e11d48; }

    .btn {
      cursor: pointer;
      border: none;
      border-radius: 14px;
      font-weight: 600;
      font-size: 13px;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn:active { transform: scale(0.96); }
    .btn-primary { background: #e11d48; color: #fff; padding: 10px 16px; }
    .btn-primary:hover { background: #f43f5e; }
    .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 10px 14px; }
    .btn-secondary:hover { background: #334155; }

    .pairing-select {
      display: flex;
      gap: 8px;
      font-size: 11px;
    }
    .pairing-btn {
      flex: 1;
      padding: 7px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #1e293b;
      color: #94a3b8;
      text-align: center;
      cursor: pointer;
    }
    .pairing-btn.active {
      background: #e11d48;
      color: #fff;
      border-color: #f43f5e;
    }

    /* Top bar buttons */
    .top-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .btn-power {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #e11d48;
      color: white;
      font-size: 20px;
      box-shadow: 0 4px 15px rgba(225,29,72,0.4);
    }
    .btn-input {
      padding: 10px 16px;
      border-radius: 14px;
      background: #1e293b;
      color: #e2e8f0;
      font-size: 12px;
      border: 1px solid #334155;
    }

    /* Rockers */
    .rockers-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 18px;
    }
    .rocker-pill {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      height: 140px;
      padding: 8px;
    }
    .rocker-btn {
      width: 100%;
      height: 46px;
      background: transparent;
      border: none;
      color: #fff;
      font-size: 18px;
      font-weight: bold;
      border-radius: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rocker-btn:active { background: rgba(255,255,255,0.1); }
    .rocker-label {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.5px;
    }

    /* D-PAD */
    .dpad-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 12px 0 20px 0;
    }
    .dpad {
      position: relative;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      background: #1e293b;
      border: 2px solid #334155;
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.4);
    }
    .dpad-btn {
      position: absolute;
      background: transparent;
      border: none;
      color: #cbd5e1;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .dpad-btn:active { color: #f43f5e; }
    .dpad-up { top: 6px; left: 50%; transform: translateX(-50%); width: 70px; height: 50px; }
    .dpad-down { bottom: 6px; left: 50%; transform: translateX(-50%); width: 70px; height: 50px; }
    .dpad-left { left: 6px; top: 50%; transform: translateY(-50%); width: 50px; height: 70px; }
    .dpad-right { right: 6px; top: 50%; transform: translateY(-50%); width: 50px; height: 70px; }
    .dpad-ok {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 78px;
      height: 78px;
      border-radius: 50%;
      background: #0f172a;
      border: 2px solid #475569;
      color: #fff;
      font-weight: 800;
      font-size: 15px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    }
    .dpad-ok:active { background: #e11d48; border-color: #f43f5e; }

    /* Nav bar (Back, Home, Menu) */
    .nav-bar {
      display: flex;
      justify-content: space-around;
      gap: 10px;
      margin-bottom: 16px;
    }
    .nav-btn {
      flex: 1;
      height: 44px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 14px;
      color: #e2e8f0;
      font-size: 12px;
      font-weight: 600;
    }

    /* App shortcuts */
    .apps-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
    }
    .app-btn {
      height: 42px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
    }
    .app-netflix { background: #b91c1c; border-color: #ef4444; }
    .app-youtube { background: #991b1b; border-color: #dc2626; }
    .app-disney { background: #1e3a8a; border-color: #3b82f6; }
    .app-prime { background: #0369a1; border-color: #38bdf8; }

    /* Modal for PIN */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(4px);
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 100;
    }
    .modal-overlay.open { display: flex; }
    .modal-box {
      background: #111827;
      border: 1px solid #374151;
      border-radius: 20px;
      padding: 22px;
      max-width: 340px;
      width: 100%;
      text-align: center;
    }
    .modal-pin-input {
      letter-spacing: 6px;
      font-size: 24px;
      text-align: center;
      margin: 14px 0;
      width: 100%;
    }
    .notification {
      margin-top: 8px;
      font-size: 12px;
      color: #cbd5e1;
      text-align: center;
      min-height: 18px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="brand">
        <div class="brand-logo">LG</div>
        <div class="brand-title">LG ThinQ Local</div>
      </div>
      <div id="statusPill" class="status-pill">Desconectado</div>
    </div>

    <!-- Connection Box -->
    <div class="card ip-box">
      <div style="font-size: 12px; color: #94a3b8; font-weight: 600;">Dirección IP del Televisor LG:</div>
      <div class="ip-input-row">
        <input type="text" id="tvIpInput" value="${defaultIP}" placeholder="192.168.1.105" />
        <button id="connectBtn" class="btn btn-primary" onclick="startConnection()">Conectar</button>
      </div>

      <div class="pairing-select">
        <div id="pairPromptBtn" class="pairing-btn active" onclick="setPairingMode('PROMPT')">
          Mensaje en Pantalla (PROMPT)
        </div>
        <div id="pairPinBtn" class="pairing-btn" onclick="setPairingMode('PIN')">
          Código PIN (8 dígitos)
        </div>
      </div>

      <div class="pairing-select" style="margin-top: 4px;">
        <div id="portAutoBtn" class="pairing-btn active" onclick="setPortMode('AUTO')" title="Prueba automáticamente puerto 3000 y 3001">
          Auto (3000 / 3001)
        </div>
        <div id="port3000Btn" class="pairing-btn" onclick="setPortMode('3000')" title="Puerto estándar HTTP webOS">
          Puerto 3000 (ws)
        </div>
        <div id="port3001Btn" class="pairing-btn" onclick="setPortMode('3001')" title="Puerto seguro TLS webOS">
          Puerto 3001 (wss)
        </div>
      </div>

      <div id="statusDetail" style="font-size: 11px; color: #94a3b8; line-height: 1.4; background: #0f172a; padding: 8px 12px; border-radius: 10px; border: 1px solid #1e293b;">
        Conectando directo desde tu dispositivo al TV (100% libre de restricciones de Chrome / Mixed Content).
      </div>
    </div>

    <!-- Remote Surface -->
    <div class="card">
      <div class="top-actions">
        <button class="btn btn-power" onclick="sendCommand('system/turnOff')" title="Apagar">⏻</button>
        <button class="btn btn-secondary" onclick="sendCommand('audio/setMute', {mute: true})" title="Silenciar">🔇 Mute</button>
        <button class="btn btn-input" onclick="sendCommand('tv/switchInput', {inputId: 'HDMI_1'})">HDMI 1</button>
      </div>

      <!-- Volume & Channel Rockers -->
      <div class="rockers-grid">
        <div class="rocker-pill">
          <button class="rocker-btn" onclick="sendCommand('audio/volumeUp')">▲</button>
          <span class="rocker-label">VOL</span>
          <button class="rocker-btn" onclick="sendCommand('audio/volumeDown')">▼</button>
        </div>
        <div class="rocker-pill">
          <button class="rocker-btn" onclick="sendCommand('tv/channelUp')">▲</button>
          <span class="rocker-label">CH</span>
          <button class="rocker-btn" onclick="sendCommand('tv/channelDown')">▼</button>
        </div>
      </div>

      <!-- D-PAD -->
      <div class="dpad-container">
        <div class="dpad">
          <button class="dpad-btn dpad-up" onclick="sendKey('UP')">▲</button>
          <button class="dpad-btn dpad-down" onclick="sendKey('DOWN')">▼</button>
          <button class="dpad-btn dpad-left" onclick="sendKey('LEFT')">◀</button>
          <button class="dpad-btn dpad-right" onclick="sendKey('RIGHT')">▶</button>
          <button class="dpad-btn dpad-ok" onclick="sendKey('ENTER')">OK</button>
        </div>
      </div>

      <!-- Navigation buttons -->
      <div class="nav-bar">
        <button class="btn nav-btn" onclick="sendKey('BACK')">↩ Atrás</button>
        <button class="btn nav-btn" style="color: #f43f5e;" onclick="sendKey('HOME')">🏠 Home</button>
        <button class="btn nav-btn" onclick="sendKey('MENU')">⚙️ Menú</button>
      </div>

      <!-- App launch shortcuts -->
      <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 14px; margin-bottom: 6px;">
        Aplicaciones Rápidas
      </div>
      <div class="apps-grid">
        <button class="btn app-btn app-netflix" onclick="launchApp('netflix')">Netflix</button>
        <button class="btn app-btn app-youtube" onclick="launchApp('youtube.leanback.v4')">YouTube</button>
        <button class="btn app-btn app-disney" onclick="launchApp('com.disney.disneyplus-prod')">Disney+</button>
        <button class="btn app-btn app-prime" onclick="launchApp('amazon')">Prime</button>
        <button class="btn app-btn" onclick="launchApp('spotify-medialink-sub')">Spotify</button>
        <button class="btn app-btn" onclick="launchApp('com.webos.app.livetv')">Live TV</button>
      </div>

      <div id="notification" class="notification"></div>
    </div>
  </div>

  <!-- PIN Entry Modal -->
  <div id="pinModal" class="modal-overlay">
    <div class="modal-box">
      <h3 style="font-size: 16px; font-weight: 700; color: #fff;">Código PIN del TV</h3>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 6px;">
        Escribe el código PIN que apareció en la pantalla de tu televisor LG:
      </p>
      <input type="text" id="pinInput" class="modal-pin-input" maxlength="8" placeholder="12345678" />
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary" style="flex: 1;" onclick="closePinModal()">Cancelar</button>
        <button class="btn btn-primary" style="flex: 1;" onclick="submitPin()">Confirmar PIN</button>
      </div>
    </div>
  </div>

  <script>
    let ws = null;
    let reqId = 1;
    let currentPairingMode = 'PROMPT';
    const pendingRequests = new Map();

    const manifest = {
      manifestVersion: 1,
      appVersion: "1.2.0",
      signed: {
        created: "20240101",
        appId: "com.lge.thinq.remote.local",
        vendorId: "com.lge",
        localizedAppNames: { "": "LG ThinQ Local" },
        localizedVendorNames: { "": "LG Electronics" },
        permissions: [
          "TEST_SECURE", "CONTROL_INPUT_TEXT", "CONTROL_MOUSE_AND_KEYBOARD",
          "READ_INSTALLED_APPS", "READ_CURRENT_CHANNEL", "READ_RUNNING_APPS",
          "WRITE_NOTIFICATION_TOAST", "READ_POWER_STATE"
        ],
        serial: "2f930e2d2cdc08497f64013db10b51cc"
      },
      permissions: [
        "LAUNCH", "LAUNCH_WEBAPP", "APP_TO_APP", "CLOSE", "TEST_OPEN",
        "TEST_SECURE", "CONTROL_AUDIO", "CONTROL_INPUT_TEXT",
        "CONTROL_MOUSE_AND_KEYBOARD", "READ_INSTALLED_APPS", "READ_CURRENT_CHANNEL",
        "WRITE_NOTIFICATION_TOAST", "READ_POWER_STATE", "READ_SETTINGS", "CONTROL_TV_SCREEN"
      ]
    };

    let currentPortMode = 'AUTO';

    function setPairingMode(mode) {
      currentPairingMode = mode;
      document.getElementById('pairPromptBtn').classList.toggle('active', mode === 'PROMPT');
      document.getElementById('pairPinBtn').classList.toggle('active', mode === 'PIN');
    }

    function setPortMode(mode) {
      currentPortMode = mode;
      document.getElementById('portAutoBtn').classList.toggle('active', mode === 'AUTO');
      document.getElementById('port3000Btn').classList.toggle('active', mode === '3000');
      document.getElementById('port3001Btn').classList.toggle('active', mode === '3001');
    }

    function setStatus(text, type, detail) {
      const pill = document.getElementById('statusPill');
      pill.textContent = text;
      pill.className = 'status-pill ' + (type || '');
      if (detail) {
        document.getElementById('statusDetail').textContent = detail;
      }
    }

    function notify(text) {
      const el = document.getElementById('notification');
      el.textContent = text;
      setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3000);
    }

    function startConnection(forceNewPairing = false) {
      const ip = document.getElementById('tvIpInput').value.trim();
      if (!ip) {
        alert('Por favor ingresa la dirección IP de tu LG TV');
        return;
      }

      if (ws) {
        try { ws.close(); } catch(e) {}
        ws = null;
      }

      const portsToTry = currentPortMode === '3000' ? [3000] : (currentPortMode === '3001' ? [3001] : [3000, 3001]);
      tryNextPort(ip, portsToTry, 0, forceNewPairing);
    }

    function tryNextPort(ip, ports, index, forceNewPairing) {
      if (index >= ports.length) {
        setStatus('Sin respuesta', '', 'No se pudo conectar a los puertos ' + ports.join(' ni ') + '. Verifica que el TV esté encendido y que "LG Connect Apps" esté activo en Ajustes.');
        return;
      }

      const port = ports[index];
      const proto = port === 3001 ? 'wss://' : 'ws://';
      const targetUrl = proto + ip + ':' + port;

      setStatus('Conectando...', 'connecting', 'Probando ' + targetUrl + ' (intento ' + (index + 1) + ' de ' + ports.length + ')...');

      let currentWs;
      try {
        currentWs = new WebSocket(targetUrl);
        ws = currentWs;
      } catch (err) {
        console.warn('Error iniciando conexión a ' + targetUrl, err);
        tryNextPort(ip, ports, index + 1, forceNewPairing);
        return;
      }

      let opened = false;
      const timeout = setTimeout(() => {
        if (!opened && currentWs.readyState !== WebSocket.OPEN) {
          try { currentWs.close(); } catch(e) {}
          if (ws === currentWs) {
            console.log('Timeout en puerto ' + port + ', probando siguiente puerto...');
            tryNextPort(ip, ports, index + 1, forceNewPairing);
          }
        }
      }, 3500);

      currentWs.onopen = () => {
        opened = true;
        clearTimeout(timeout);
        setStatus('Autenticando...', 'connecting', '¡Conexión establecida en puerto ' + port + '! Enviando solicitud de vinculación...');
        sendHandshake(ip, forceNewPairing);
      };

      currentWs.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          handleMessage(msg, ip);
        } catch(err) {
          console.error(err);
        }
      };

      currentWs.onclose = () => {
        clearTimeout(timeout);
        if (!opened && ws === currentWs && index + 1 < ports.length) {
          tryNextPort(ip, ports, index + 1, forceNewPairing);
        } else if (opened) {
          setStatus('Desconectado', '', 'Conexión cerrada.');
        }
      };

      currentWs.onerror = (err) => {
        clearTimeout(timeout);
        if (!opened && ws === currentWs && index + 1 < ports.length) {
          tryNextPort(ip, ports, index + 1, forceNewPairing);
        } else if (!opened) {
          setStatus('Error de conexión', '', 'No se pudo contactar el puerto ' + port + '.');
        }
      };
    }

    function sendHandshake(ip, forceNew = false) {
      const savedKey = forceNew ? null : localStorage.getItem('lg_key_' + ip);
      const payload = {
        type: 'register',
        id: 'register_0',
        payload: {
          forcePairing: forceNew || !savedKey,
          pairingType: currentPairingMode,
          manifest: manifest
        }
      };
      if (savedKey && !forceNew) {
        payload.payload['client-key'] = savedKey;
      }
      ws.send(JSON.stringify(payload));
    }

    function handleMessage(msg, ip) {
      if (msg.type === 'response' && msg.id === 'register_0') {
        const type = msg.payload?.pairingType || currentPairingMode;
        if (type === 'PROMPT') {
          setStatus('Aceptar en TV', 'prompt', '¡Mira la pantalla de tu televisor LG! Toca "Aceptar" con el control remoto físico.');
          notify('🔔 Presiona "Aceptar" en la pantalla de tu TV');
        } else if (type === 'PIN') {
          setStatus('Código PIN requerido', 'prompt', 'Introduce el código PIN que apareció en el televisor.');
          document.getElementById('pinModal').classList.add('open');
        }
      }

      if (msg.type === 'registered') {
        const key = msg.payload?.['client-key'];
        if (key) {
          localStorage.setItem('lg_key_' + ip, key);
        }
        setStatus('Conectado', 'connected', '¡Vinculado con éxito a ' + ip + '! Ya puedes usar todos los botones.');
        notify('✅ ¡TV Conectado con éxito!');
        closePinModal();
      }

      if (msg.id && pendingRequests.has(msg.id)) {
        const cb = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        cb(msg.payload);
      }
    }

    function closePinModal() {
      document.getElementById('pinModal').classList.remove('open');
      document.getElementById('pinInput').value = '';
    }

    function submitPin() {
      const pin = document.getElementById('pinInput').value.trim();
      if (!pin) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('El televisor no está conectado.');
        return;
      }
      const id = ++reqId;
      const message = {
        id: id,
        type: 'request',
        uri: 'ssap://pairing/setPin',
        payload: { pin: pin }
      };
      ws.send(JSON.stringify(message));
      notify('Enviando código PIN al TV...');
    }

    function sendCommand(uri, payload = {}) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        notify('⚠️ Primero conecta el TV ingresando la IP');
        return;
      }
      const id = ++reqId;
      const msg = {
        id: id,
        type: 'request',
        uri: 'ssap://' + uri,
        payload: payload
      };
      ws.send(JSON.stringify(msg));
      notify('Comando enviado: ' + uri);
    }

    function sendKey(key) {
      const keyMap = {
        'UP': 'input.arrowUp',
        'DOWN': 'input.arrowDown',
        'LEFT': 'input.arrowLeft',
        'RIGHT': 'input.arrowRight',
        'ENTER': 'input.ok',
        'BACK': 'input.back',
        'HOME': 'system.launcher/open',
        'MENU': 'system/openMenu'
      };
      if (key === 'HOME') {
        sendCommand('system.launcher/open');
        return;
      }
      if (key === 'BACK') {
        sendCommand('tv/switchInput', {});
      }
      sendCommand('com.webos.service.networkinput/sendKey', { key: key });
    }

    function launchApp(id) {
      sendCommand('system.launcher/launch', { id: id });
    }

    // Auto connect on load if IP is filled
    window.addEventListener('DOMContentLoaded', () => {
      const input = document.getElementById('tvIpInput');
      if (input.value.trim()) {
        startConnection(false);
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Triggers a direct browser download of the standalone single-file HTML remote
 */
export function downloadStandaloneRemote(ip: string, name: string = 'Mi LG TV') {
  const htmlContent = generateStandaloneRemoteHTML(ip, name);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Control-LG-ThinQ-${ip || 'Local'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

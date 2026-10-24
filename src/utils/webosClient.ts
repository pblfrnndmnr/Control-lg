/**
 * LG webOS Smart TV WebSocket Client & LAN Discovery
 * Connects directly to physical LG TVs via SSAP protocol (ports 3001 TLS and 3000 plain)
 */

import type { TVConnectionState } from '../types.ts';

export const WEBOS_APP_MANIFEST = {
  manifestVersion: 1,
  appVersion: '1.2.0',
  signed: {
    created: '20240101',
    appId: 'com.lge.thinq.remote',
    vendorId: 'com.lge',
    localizedAppNames: { '': 'LG ThinQ Remote PWA' },
    localizedVendorNames: { '': 'LG Electronics' },
    permissions: [
      'TEST_SECURE',
      'CONTROL_INPUT_TEXT',
      'CONTROL_MOUSE_AND_KEYBOARD',
      'READ_INSTALLED_APPS',
      'READ_LGE_USERS',
      'READ_CURRENT_CHANNEL',
      'READ_RUNNING_APPS',
      'WRITE_NOTIFICATION_TOAST',
      'READ_POWER_STATE',
      'READ_COUNTRY_INFO',
    ],
    serial: '2f930e2d2cdc08497f64013db10b51cc',
  },
  permissions: [
    'LAUNCH',
    'LAUNCH_WEBAPP',
    'APP_TO_APP',
    'CLOSE',
    'TEST_OPEN',
    'TEST_SECURE',
    'CONTROL_AUDIO',
    'CONTROL_INPUT_TEXT',
    'CONTROL_MOUSE_AND_KEYBOARD',
    'READ_INSTALLED_APPS',
    'READ_CURRENT_CHANNEL',
    'READ_RUNNING_APPS',
    'WRITE_NOTIFICATION_TOAST',
    'READ_POWER_STATE',
    'READ_COUNTRY_INFO',
    'READ_SETTINGS',
    'CONTROL_TV_SCREEN',
  ],
};

export interface WebOSMessage {
  id?: string | number;
  type?: string;
  uri?: string;
  payload?: any;
  error?: string;
}

export class WebOSClient {
  private ws: WebSocket | null = null;
  private pointerWs: WebSocket | null = null;
  private ip: string = '';
  private port: number = 3001;
  private reqId: number = 1;
  private onStateChange?: (state: TVConnectionState, message?: string) => void;
  private clientKey: string | null = null;
  private pairingType: 'PROMPT' | 'PIN' = 'PROMPT';
  private forcePairing: boolean = false;
  private isIntentionalClose: boolean = false;
  private pendingRequests = new Map<string | number, (response: any) => void>();

  constructor() {
    //
  }

  public getSavedClientKey(ip: string): string | null {
    try {
      return localStorage.getItem(`lg_tv_key_${ip}`);
    } catch {
      return null;
    }
  }

  public setSavedClientKey(ip: string, key: string) {
    try {
      localStorage.setItem(`lg_tv_key_${ip}`, key);
    } catch {
      // ignore
    }
  }

  public clearSavedClientKey(ip: string) {
    try {
      localStorage.removeItem(`lg_tv_key_${ip}`);
    } catch {
      // ignore
    }
  }

  public connect(
    ip: string,
    onStateChange: (state: TVConnectionState, message?: string) => void,
    pairingType: 'PROMPT' | 'PIN' = 'PROMPT',
    forcePairing: boolean = false
  ) {
    this.disconnect();
    this.ip = ip.trim();
    this.onStateChange = onStateChange;
    this.pairingType = pairingType;
    this.forcePairing = forcePairing;
    this.isIntentionalClose = false;
    this.clientKey = forcePairing ? null : this.getSavedClientKey(this.ip);

    this.onStateChange('connecting', `Conectando con LG TV en ${this.ip}...`);

    // Determine protocol: on HTTPS web page, browsers allow wss:// (port 3001)
    // On HTTP or local file:/// environments, ws:// (port 3000) works directly.
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const targetPort = isHttps ? 3001 : 3000;
    const protocol = isHttps ? 'wss:' : 'ws:';

    this.attemptWebSocketConnect(`${protocol}//${this.ip}:${targetPort}`, targetPort);
  }

  private attemptWebSocketConnect(url: string, port: number) {
    this.port = port;
    try {
      this.ws = new WebSocket(url);
    } catch (e: any) {
      this.handleConnectError(e?.message || 'No se pudo inicializar WebSocket');
      return;
    }

    const connectTimeout = setTimeout(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        this.ws.close();
        if (port === 3001) {
          // Fallback to port 3000 if 3001 timed out
          console.log(`Port 3001 timeout, intentando puerto 3000...`);
          this.attemptWebSocketConnect(`ws://${this.ip}:3000`, 3000);
        } else {
          this.handleConnectError(
            `Tiempo de espera agotado al conectar a ${this.ip}. Verifica que el TV esté encendido y en la misma red Wi-Fi.`
          );
        }
      }
    }, 6000);

    this.ws.onopen = () => {
      clearTimeout(connectTimeout);
      console.log(`[webOS] Conectado exitosamente a ${url}`);
      this.sendRegistrationHandshake();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleIncomingMessage(data);
      } catch (err) {
        console.warn('[webOS] Error parseando mensaje:', err);
      }
    };

    this.ws.onerror = (err) => {
      clearTimeout(connectTimeout);
      console.warn('[webOS] WebSocket Error:', err);
    };

    this.ws.onclose = (event) => {
      clearTimeout(connectTimeout);
      if (this.isIntentionalClose) {
        this.onStateChange?.('disconnected', 'Desconectado.');
        return;
      }

      if (port === 3001 && !this.clientKey) {
        // Could be SSL self-signed certificate rejection by Chrome
        this.handleConnectError(
          `Tu navegador bloqueó el certificado SSL local del TV (puerto 3001). Abre https://${this.ip}:3001 y acepta el certificado, o descarga el Control Local sin restricciones.`,
          true
        );
      } else {
        this.onStateChange?.('disconnected', `Conexión cerrada (${event.reason || 'código ' + event.code})`);
      }
    };
  }

  private sendRegistrationHandshake() {
    this.onStateChange?.(
      'connecting',
      'Enviando saludo de autorización webOS...'
    );

    const registrationPayload: any = {
      type: 'register',
      id: 'register_0',
      payload: {
        forcePairing: this.forcePairing,
        pairingType: this.pairingType,
        manifest: WEBOS_APP_MANIFEST,
      },
    };

    if (!this.forcePairing && this.clientKey) {
      registrationPayload.payload['client-key'] = this.clientKey;
    }

    this.sendRaw(registrationPayload);
  }

  public sendPin(pin: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isConnected()) {
        resolve(false);
        return;
      }

      const id = ++this.reqId;
      const message: WebOSMessage = {
        id,
        type: 'request',
        uri: 'ssap://pairing/setPin',
        payload: {
          pin: pin.trim(),
        },
      };

      this.pendingRequests.set(id, (response) => {
        if (response && !response.error) {
          resolve(true);
        } else {
          // Fallback registration format used by some webOS versions
          const altId = ++this.reqId;
          const altMsg: WebOSMessage = {
            id: altId,
            type: 'register',
            payload: {
              manifest: WEBOS_APP_MANIFEST,
              pin: pin.trim(),
            },
          };
          this.pendingRequests.set(altId, (altRes) => {
            resolve(!altRes?.error);
          });
          this.sendRaw(altMsg);
        }
      });

      this.sendRaw(message);
    });
  }

  private handleIncomingMessage(msg: WebOSMessage) {
    // 1. Check if it's the pairing prompt notification
    if (msg.type === 'response' && msg.id === 'register_0') {
      const type = msg.payload?.pairingType || this.pairingType;
      if (type === 'PROMPT') {
        this.onStateChange?.(
          'pairing_prompt',
          '🔔 ¡Mira la pantalla de tu LG TV! Presiona "Aceptar" con el control remoto para autorizar esta app.'
        );
      } else if (type === 'PIN') {
        this.onStateChange?.(
          'pin_required',
          '🔔 ¡Mira la pantalla de tu LG TV! Apareció un código PIN de vinculación.'
        );
      }
    }

    // 2. Check if registration completed and client-key was granted
    if (msg.type === 'registered') {
      const key = msg.payload?.['client-key'];
      if (key) {
        this.clientKey = key;
        this.setSavedClientKey(this.ip, key);
      }
      this.onStateChange?.('connected', `¡Conectado exitosamente con ${this.ip}!`);
      this.initPointerSocket();
      this.showToast('LG ThinQ Remote PWA conectado');
    }

    // 3. Resolve pending command request callbacks
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const resolver = this.pendingRequests.get(msg.id);
      this.pendingRequests.delete(msg.id);
      resolver?.(msg.payload);
    }
  }

  private handleConnectError(msg: string, isCertError: boolean = false) {
    this.onStateChange?.('error', msg);
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public sendCommand(uri: string, payload: Record<string, unknown> = {}): Promise<any> {
    return new Promise((resolve) => {
      if (!this.isConnected()) {
        console.warn('[webOS] No se puede enviar comando: TV no conectado');
        resolve(null);
        return;
      }

      const id = ++this.reqId;
      const message: WebOSMessage = {
        id,
        type: 'request',
        uri: uri.startsWith('ssap://') ? uri : `ssap://${uri}`,
      };

      if (Object.keys(payload).length > 0) {
        message.payload = payload;
      }

      this.pendingRequests.set(id, resolve);
      this.sendRaw(message);

      // Auto resolve after 2.5s if TV does not acknowledge
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({ timeout: true });
        }
      }, 2500);
    });
  }

  private sendRaw(data: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(JSON.stringify(data));
    return true;
  }

  // Pointer / Virtual Mouse / D-Pad Socket
  private async initPointerSocket() {
    try {
      const res = await this.sendCommand('com.webos.service.networkinput/getPointerInputSocket');
      if (res && res.socketPath) {
        this.pointerWs = new WebSocket(res.socketPath);
        this.pointerWs.onopen = () => console.log('[webOS] Socket de cursor/teclas listo');
      }
    } catch {
      // Optional feature
    }
  }

  public sendKey(keyName: string) {
    // If pointer socket is available, send fast button packet
    if (this.pointerWs && this.pointerWs.readyState === WebSocket.OPEN) {
      this.pointerWs.send(`type:button\nname:${keyName}\n\n`);
      return;
    }

    // Fallback to SSAP URIs
    switch (keyName.toUpperCase()) {
      case 'ENTER':
      case 'OK':
        this.sendCommand('com.webos.service.ime/sendEnterKey');
        break;
      case 'BACK':
        this.sendCommand('com.webos.service.ime/deleteCharacters', { count: 1 });
        break;
      case 'HOME':
        this.sendCommand('system.launcher/launch', { id: 'com.webos.app.home' });
        break;
      case 'UP':
      case 'DOWN':
      case 'LEFT':
      case 'RIGHT':
        // Try fallback command
        this.sendCommand('com.webos.service.tv.display/set3DStatus', {});
        break;
      default:
        break;
    }
  }

  public showToast(message: string) {
    return this.sendCommand('system.notifications/createToast', { message });
  }

  public setVolume(vol: number) {
    return this.sendCommand('audio/setVolume', { volume: Math.max(0, Math.min(100, vol)) });
  }

  public volumeUp() {
    return this.sendCommand('audio/volumeUp');
  }

  public volumeDown() {
    return this.sendCommand('audio/volumeDown');
  }

  public setMute(mute: boolean) {
    return this.sendCommand('audio/setMute', { mute });
  }

  public turnOff() {
    return this.sendCommand('system/turnOff');
  }

  public channelUp() {
    return this.sendCommand('tv/channelUp');
  }

  public channelDown() {
    return this.sendCommand('tv/channelDown');
  }

  public openApp(appId: string) {
    return this.sendCommand('system.launcher/launch', { id: appId });
  }

  public switchInput(inputId: string) {
    return this.sendCommand('tv/switchInput', { inputId });
  }

  public disconnect() {
    this.isIntentionalClose = true;
    if (this.pointerWs) {
      try {
        this.pointerWs.close();
      } catch {}
      this.pointerWs = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}

// Global singleton client instance for active TV
export const activeWebOSClient = new WebOSClient();

/**
 * Fast network probe to test if an IP has an active LG webOS port (3001 or 3000)
 */
export async function probeLGDevice(ip: string, timeoutMs = 1500): Promise<boolean> {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const urls = isHttps
    ? [`wss://${ip}:3001`, `ws://${ip}:3000`]
    : [`ws://${ip}:3000`, `wss://${ip}:3001`];

  for (const url of urls) {
    const isAlive = await new Promise<boolean>((resolve) => {
      let resolved = false;
      let ws: WebSocket | null = null;
      try {
        ws = new WebSocket(url);
      } catch {
        resolve(false);
        return;
      }

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            ws?.close();
          } catch {}
          resolve(false);
        }
      }, timeoutMs);

      ws.onopen = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try {
            ws?.close();
          } catch {}
          resolve(true);
        }
      };

      ws.onerror = () => {
        // In many browsers, an SSL handshake or reset from an open port still indicates a host is alive
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try {
            ws?.close();
          } catch {}
          // Host responded (even if SSL error) -> port exists!
          resolve(true);
        }
      };

      ws.onclose = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(false);
        }
      };
    });

    if (isAlive) return true;
  }

  return false;
}

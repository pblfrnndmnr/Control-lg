/**
 * LG Smart TV (webOS) Protocol Utilities & Natural Command Parser
 */

export interface LGTVCommand {
  action:
    | 'POWER_ON'
    | 'POWER_OFF'
    | 'VOLUME_UP'
    | 'VOLUME_DOWN'
    | 'SET_VOLUME'
    | 'MUTE_TOGGLE'
    | 'CHANNEL_UP'
    | 'CHANNEL_DOWN'
    | 'SET_CHANNEL'
    | 'LAUNCH_APP'
    | 'SWITCH_INPUT'
    | 'SET_PICTURE_MODE'
    | 'NAVIGATE'
    | 'MEDIA_CONTROL'
    | 'SET_SLEEP_TIMER'
    | 'CANCEL_SLEEP_TIMER'
    | 'UNKNOWN';
  value?: string | number;
  label?: string;
}

export interface DiscoveredTV {
  id: string;
  name: string;
  model: string;
  ip: string;
  port: number;
  mac: string;
  webOSVersion: string;
  paired: boolean;
  powerState: 'on' | 'standby' | 'off';
}

/**
 * Validates standard MAC address format (e.g. 00:1A:2B:3C:4D:5E or 00-1A-2B-3C-4D-5E)
 */
export function validateMacAddress(mac: string): boolean {
  if (!mac || typeof mac !== 'string') return false;
  const cleaned = mac.trim().replace(/[:-]/g, '');
  return cleaned.length === 12 && /^[0-9A-Fa-f]{12}$/.test(cleaned);
}

/**
 * Generates an authentic Wake-On-LAN (WoL) 102-byte magic packet buffer
 * (6 bytes of 0xFF followed by 16 repetitions of 6-byte target MAC)
 */
export function createWakeOnLanPacket(mac: string): Uint8Array {
  if (!validateMacAddress(mac)) {
    throw new Error(`Invalid MAC address: ${mac}`);
  }
  const cleanMac = mac.trim().replace(/[:-]/g, '');
  const macBytes = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    macBytes[i] = parseInt(cleanMac.substring(i * 2, i * 2 + 2), 16);
  }

  const packet = new Uint8Array(102);
  // Header: 6 bytes of 0xFF
  packet.fill(0xff, 0, 6);

  // Body: 16 copies of MAC bytes
  for (let rep = 0; rep < 16; rep++) {
    const offset = 6 + rep * 6;
    packet.set(macBytes, offset);
  }

  return packet;
}

/**
 * Clamps volume between 0 and 100
 */
export function clampVolume(current: number, delta: number): number {
  const result = current + delta;
  return Math.max(0, Math.min(100, Math.round(result)));
}

/**
 * Formats channel number display
 */
export function formatChannelDisplay(major: number, minor?: number): string {
  const safeMajor = Math.max(1, Math.min(999, Math.floor(major)));
  if (minor !== undefined && minor > 0) {
    return `${safeMajor}-${minor}`;
  }
  return `${safeMajor}`;
}

/**
 * Formats sleep timer remaining seconds into MM:SS or Xh YYm
 */
export function formatRemainingTime(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Verifies 8-digit or alphanumeric pairing PIN
 */
export function verifyPairingPin(entered: string, expected: string): boolean {
  if (!entered || !expected) return false;
  return entered.trim().toUpperCase() === expected.trim().toUpperCase();
}

/**
 * Builds authentic LG webOS JSON message
 */
export function buildWebOSPayload(
  command: string,
  params: Record<string, unknown> = {},
  requestId = 1
): { id: number; type: string; uri: string; payload?: Record<string, unknown> } {
  const uriMap: Record<string, string> = {
    turnOff: 'ssap://system/turnOff',
    volumeUp: 'ssap://audio/volumeUp',
    volumeDown: 'ssap://audio/volumeDown',
    setVolume: 'ssap://audio/setVolume',
    setMute: 'ssap://audio/setMute',
    getVolume: 'ssap://audio/getVolumeStatus',
    channelUp: 'ssap://tv/channelUp',
    channelDown: 'ssap://tv/channelDown',
    openApp: 'ssap://system.launcher/launch',
    closeApp: 'ssap://system.launcher/close',
    switchInput: 'ssap://tv/switchInput',
    showToast: 'ssap://system.notifications/createToast',
    sendEnter: 'ssap://com.webos.service.ime/sendEnterKey',
  };

  const uri = uriMap[command] || `ssap://${command}`;

  return {
    id: requestId,
    type: 'request',
    uri,
    ...(Object.keys(params).length > 0 ? { payload: params } : {}),
  };
}
export const WEBOS_APP_MAP: Record<string, string> = {
  netflix: 'netflix',
  youtube: 'youtube.leanback.v4',
  prime: 'amazon',
  disney: 'com.disney.disneyplus-prod',
  spotify: 'spotify-beehive',
  appletv: 'com.apple.appletv',
  twitch: 'twitch',
  hbomax: 'max',
  browser: 'com.webos.app.browser',
  lgchannels: 'com.webos.app.livetv',
};

export function getAppIdFromKey(key: string): string {
  const clean = key.toLowerCase().trim();
  return WEBOS_APP_MAP[clean] || clean;
}
/**
 * Parses natural language commands in Spanish and English into actionable TV intents
 */
export function parseNaturalLanguageCommand(rawText: string): LGTVCommand {
  if (!rawText || typeof rawText !== 'string') {
    return { action: 'UNKNOWN' };
  }

  const text = rawText.toLowerCase().trim();

  // Volume numeric: "volumen a 25", "fijar volumen en 40", "set volume to 15", "vol 30"
  const volMatch = text.match(/(?:volumen|vol|volume)(?:\s+(?:a|al|en|to))?\s+(\d{1,3})/i);
  if (volMatch && volMatch[1]) {
    const val = parseInt(volMatch[1], 10);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      return { action: 'SET_VOLUME', value: val, label: `Fijar volumen a ${val}%` };
    }
  }

  // Volume Up
  if (
    text.includes('sube el volumen') ||
    text.includes('subir volumen') ||
    text.includes('mas volumen') ||
    text.includes('más volumen') ||
    text.includes('volume up') ||
    text.includes('turn up') ||
    text === 'subir' ||
    text === 'vol+' ||
    text === 'volumen+'
  ) {
    return { action: 'VOLUME_UP', label: 'Subir volumen' };
  }

  // Volume Down
  if (
    text.includes('baja el volumen') ||
    text.includes('bajar volumen') ||
    text.includes('menos volumen') ||
    text.includes('volume down') ||
    text.includes('turn down') ||
    text === 'bajar' ||
    text === 'vol-' ||
    text === 'volumen-'
  ) {
    return { action: 'VOLUME_DOWN', label: 'Bajar volumen' };
  }

  // Mute
  if (
    text.includes('silencio') ||
    text.includes('mutear') ||
    text.includes('desmutear') ||
    text.includes('mute') ||
    text.includes('quitar sonido')
  ) {
    return { action: 'MUTE_TOGGLE', label: 'Alternar silencio (Mute)' };
  }

  // Cancel Sleep Timer
  if (
    text.includes('cancelar temporizador') ||
    text.includes('quitar temporizador') ||
    text.includes('desactivar temporizador') ||
    text.includes('cancel timer') ||
    text.includes('cancel sleep timer')
  ) {
    return { action: 'CANCEL_SLEEP_TIMER', label: 'Temporizador de apagado cancelado' };
  }

  // Set Sleep Timer: "apagar en 30 minutos", "temporizador 60", "apágate en 90 min"
  const timerMatch = text.match(/(?:temporizador|sleep\s*timer|apagar(?:se)?\s+en|apágate\s+en)\s*(?:de\s*)?(\d{1,3})\s*(?:min|minuto|minutos)?/i);
  if (timerMatch && timerMatch[1]) {
    const mins = parseInt(timerMatch[1], 10);
    if (!isNaN(mins) && mins > 0) {
      return { action: 'SET_SLEEP_TIMER', value: mins, label: `Temporizador de apagado: ${mins} min` };
    }
  }

  // Power Off
  if (
    text.includes('apagar') ||
    text.includes('apaga') ||
    text.includes('apágate') ||
    text.includes('power off') ||
    text.includes('turn off') ||
    text.includes('desconectar tv')
  ) {
    return { action: 'POWER_OFF', label: 'Apagar televisor' };
  }

  // Power On
  if (
    text.includes('encender') ||
    text.includes('enciende') ||
    text.includes('prender') ||
    text.includes('prende') ||
    text.includes('power on') ||
    text.includes('turn on') ||
    text.includes('wake')
  ) {
    return { action: 'POWER_ON', label: 'Encender televisor (WoL)' };
  }

  // Channel numeric: "canal 7", "pon el canal 12", "channel 5"
  const channelMatch = text.match(/(?:canal|channel)\s+(\d{1,3})/i);
  if (channelMatch && channelMatch[1]) {
    const ch = parseInt(channelMatch[1], 10);
    return { action: 'SET_CHANNEL', value: ch, label: `Cambiar a Canal ${ch}` };
  }

  // Channel stepping
  if (text.includes('siguiente canal') || text.includes('canal arriba') || text.includes('channel up')) {
    return { action: 'CHANNEL_UP', label: 'Canal arriba' };
  }
  if (text.includes('canal anterior') || text.includes('canal abajo') || text.includes('channel down')) {
    return { action: 'CHANNEL_DOWN', label: 'Canal abajo' };
  }

  // App Launching
  const apps = [
    { key: 'netflix', terms: ['netflix'] },
    { key: 'youtube', terms: ['youtube', 'yutub'] },
    { key: 'prime', terms: ['prime video', 'amazon prime', 'prime'] },
    { key: 'disney', terms: ['disney', 'disney+', 'disney plus'] },
    { key: 'spotify', terms: ['spotify'] },
    { key: 'appletv', terms: ['apple tv', 'apple tv+'] },
    { key: 'twitch', terms: ['twitch'] },
    { key: 'hbomax', terms: ['hbo', 'max', 'hbo max'] },
    { key: 'browser', terms: ['navegador', 'browser', 'internet'] },
    { key: 'lgchannels', terms: ['lg channels', 'canales lg'] },
  ];

  for (const app of apps) {
    for (const term of app.terms) {
      if (text.includes(term)) {
        return { action: 'LAUNCH_APP', value: app.key, label: `Abrir ${term.toUpperCase()}` };
      }
    }
  }

  // Input switching: HDMI 1, HDMI 2, etc.
  const hdmiMatch = text.match(/hdmi\s*([1-4])/i);
  if (hdmiMatch && hdmiMatch[1]) {
    const port = hdmiMatch[1];
    return { action: 'SWITCH_INPUT', value: `hdmi${port}`, label: `Entrada HDMI ${port}` };
  }

  if (text.includes('antena') || text.includes('tv en vivo') || text.includes('live tv')) {
    return { action: 'SWITCH_INPUT', value: 'livetv', label: 'Entrada TV en vivo' };
  }

  // Picture mode presets
  if (text.includes('cine') || text.includes('cinema') || text.includes('pelicula')) {
    return { action: 'SET_PICTURE_MODE', value: 'cinema', label: 'Modo de Imagen: Cine' };
  }
  if (text.includes('juego') || text.includes('gaming') || text.includes('game optimizer')) {
    return { action: 'SET_PICTURE_MODE', value: 'game', label: 'Modo de Imagen: Optimizador de Juegos' };
  }
  if (text.includes('filmmaker')) {
    return { action: 'SET_PICTURE_MODE', value: 'filmmaker', label: 'Modo de Imagen: Filmmaker Mode' };
  }
  if (text.includes('vivido') || text.includes('vívido') || text.includes('vivid')) {
    return { action: 'SET_PICTURE_MODE', value: 'vivid', label: 'Modo de Imagen: Vívido' };
  }

  // Navigation commands
  if (text === 'arriba' || text === 'up') return { action: 'NAVIGATE', value: 'UP', label: 'Navegar Arriba' };
  if (text === 'abajo' || text === 'down') return { action: 'NAVIGATE', value: 'DOWN', label: 'Navegar Abajo' };
  if (text === 'izquierda' || text === 'left') return { action: 'NAVIGATE', value: 'LEFT', label: 'Navegar Izquierda' };
  if (text === 'derecha' || text === 'right') return { action: 'NAVIGATE', value: 'RIGHT', label: 'Navegar Derecha' };
  if (text === 'ok' || text === 'enter' || text === 'seleccionar') return { action: 'NAVIGATE', value: 'OK', label: 'Botón OK' };
  if (text === 'atras' || text === 'atrás' || text === 'back') return { action: 'NAVIGATE', value: 'BACK', label: 'Volver Atrás' };
  if (text === 'home' || text === 'inicio' || text === 'menu') return { action: 'NAVIGATE', value: 'HOME', label: 'Menú Inicio (webOS Home)' };

  // Media playback
  if (text.includes('pausa') || text === 'pause') return { action: 'MEDIA_CONTROL', value: 'PAUSE', label: 'Pausar' };
  if (text.includes('reproducir') || text.includes('play') || text === 'continua') return { action: 'MEDIA_CONTROL', value: 'PLAY', label: 'Reproducir' };

  return { action: 'UNKNOWN' };
}

export type PowerState = 'on' | 'standby' | 'off';

export type InputSource = 'hdmi1' | 'hdmi2' | 'hdmi3' | 'hdmi4' | 'livetv' | 'av';

export type PictureMode = 'cinema' | 'game' | 'filmmaker' | 'vivid' | 'standard';

export type SoundMode = 'ai_pro' | 'standard' | 'cinema' | 'game';

export interface SleepTimerState {
  minutes: number;
  remainingSeconds: number;
}

export interface TVState {
  power: PowerState;
  volume: number;
  isMuted: boolean;
  channel: { major: number; name: string };
  activeInput: InputSource;
  activeApp: string | null;
  pictureMode: PictureMode;
  soundMode: SoundMode;
  showLauncher: boolean;
  pointer: { x: number; y: number; visible: boolean };
  recentNotification: string | null;
  sleepTimer: SleepTimerState | null;
}

export type TVConnectionState = 'disconnected' | 'connecting' | 'pairing_prompt' | 'pin_required' | 'connected' | 'error';

export interface DiscoveredTV {
  id: string;
  name: string;
  model: string;
  ip: string;
  mac: string;
  port: number;
  webOSVersion: string;
  paired: boolean;
  pairingPin: string;
  signalStrength: number;
  isPhysical?: boolean;
  connectionState?: TVConnectionState;
  pairingMode?: 'PROMPT' | 'PIN';
  clientKey?: string;
  errorMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  commandExecuted?: string;
  modelUsed?: string;
}

export interface AppShortcut {
  id: string;
  name: string;
  iconBg: string;
  category: string;
  description: string;
}

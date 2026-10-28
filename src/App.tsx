/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Tv,
  Wifi,
  Sparkles,
  Smartphone,
  Sliders,
  CheckCircle2,
  Maximize2,
  Info,
  AlertTriangle,
  ExternalLink,
  Key,
  Download,
} from 'lucide-react';
import type { TVState, DiscoveredTV, InputSource, PictureMode } from './types.ts';
import {
  clampVolume,
  formatChannelDisplay,
  verifyPairingPin,
  formatRemainingTime,
  getAppIdFromKey,
} from './utils/tvProtocol.ts';
import { activeWebOSClient } from './utils/webosClient.ts';
import { playHapticClick, playSuccessBeep } from './utils/audioFeedback.ts';
import { downloadStandaloneRemote } from './utils/standaloneRemote.ts';
import { AndroidPhoneFrame } from './components/AndroidPhoneFrame.tsx';
import { RemoteControlPad } from './components/RemoteControlPad.tsx';
import { VirtualLGOledTV } from './components/VirtualLGOledTV.tsx';
import { DeviceScannerModal } from './components/DeviceScannerModal.tsx';
import { GeminiAssistantModal } from './components/GeminiAssistantModal.tsx';
import { PythonExportModal } from './components/PythonExportModal.tsx';
import { KotlinExportModal } from './components/KotlinExportModal.tsx';
import { AndroidInstallModal } from './components/AndroidInstallModal.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';

const SAVED_TVS_KEY = 'lg_thinq_saved_tvs';
const LAST_ACTIVE_TV_KEY = 'lg_thinq_last_active_tv';

const INITIAL_TV_STATE: TVState = {
  power: 'on',
  volume: 18,
  isMuted: false,
  channel: { major: 7, name: 'LG Cinema 4K' },
  activeInput: 'hdmi2',
  activeApp: null,
  pictureMode: 'cinema',
  soundMode: 'ai_pro',
  showLauncher: false,
  pointer: { x: 50, y: 50, visible: true },
  recentNotification: null,
  sleepTimer: null,
};

const DEFAULT_TVS: DiscoveredTV[] = [
  {
    id: 'lg-oled-c3-demo',
    name: 'LG OLED C3 (Simulador Virtual)',
    model: 'OLED65C3PSA',
    ip: '192.168.1.105',
    mac: 'A4:08:01:2C:9E:54',
    port: 3001,
    webOSVersion: 'webOS 23',
    paired: true,
    pairingPin: '849201',
    signalStrength: 98,
    isPhysical: false,
    connectionState: 'connected',
  },
  {
    id: 'lg-living-room',
    name: 'LG Smart TV (Salón / Living)',
    model: 'LG webOS Smart TV',
    ip: '192.168.1.50',
    mac: '',
    port: 3001,
    webOSVersion: 'webOS 22/23/24',
    paired: false,
    pairingPin: '123456',
    signalStrength: 85,
    isPhysical: true,
    connectionState: 'disconnected',
  },
];

function loadSavedTVs(): DiscoveredTV[] {
  try {
    const raw = localStorage.getItem(SAVED_TVS_KEY);
    if (raw) {
      const parsed: DiscoveredTV[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge saved with demo
        const demo = DEFAULT_TVS[0];
        return [...parsed, demo];
      }
    }
  } catch {}
  return DEFAULT_TVS;
}

function loadInitialActiveTV(tvs: DiscoveredTV[]): DiscoveredTV {
  try {
    const lastId = localStorage.getItem(LAST_ACTIVE_TV_KEY);
    if (lastId) {
      const found = tvs.find((t) => t.id === lastId);
      if (found) return found;
    }
  } catch {}
  // Default to first physical TV if any, otherwise first in list
  return tvs.find((t) => t.isPhysical) || tvs[0];
}

export default function App() {
  const [tvState, setTvState] = useState<TVState>(INITIAL_TV_STATE);
  const [availableTVs, setAvailableTVs] = useState<DiscoveredTV[]>(loadSavedTVs);
  const [activeTV, setActiveTV] = useState<DiscoveredTV>(() => loadInitialActiveTV(availableTVs));

  // Modals & Navigation state
  const [isDeviceScannerOpen, setIsDeviceScannerOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [isKotlinModalOpen, setIsKotlinModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [pairingPending, setPairingPending] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [showTVPreviewModal, setShowTVPreviewModal] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sleep Timer countdown interval
  useEffect(() => {
    if (!tvState.sleepTimer || tvState.power !== 'on') return;

    const interval = setInterval(() => {
      setTvState((prev) => {
        if (!prev.sleepTimer) return prev;
        if (prev.sleepTimer.remainingSeconds <= 1) {
          triggerNotification('Temporizador finalizado: Apagando televisor LG.');
          playSuccessBeep();
          if (activeTV.isPhysical) {
            activeWebOSClient.turnOff();
          }
          return {
            ...prev,
            power: 'off',
            showLauncher: false,
            sleepTimer: null,
          };
        }
        return {
          ...prev,
          sleepTimer: {
            ...prev.sleepTimer,
            remainingSeconds: prev.sleepTimer.remainingSeconds - 1,
          },
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [tvState.sleepTimer, tvState.power, activeTV]);

  // Connect / Manage webOS client when activeTV changes
  useEffect(() => {
    if (!activeTV) return;

    if (activeTV.isPhysical) {
      activeWebOSClient.connect(
        activeTV.ip,
        (state, message) => {
          setActiveTV((prev) => {
            if (prev.id !== activeTV.id) return prev;
            return {
              ...prev,
              connectionState: state,
              paired: state === 'connected' ? true : prev.paired,
              errorMessage: state === 'error' ? message : undefined,
            };
          });

          setAvailableTVs((prev) =>
            prev.map((t) =>
              t.id === activeTV.id
                ? {
                    ...t,
                    connectionState: state,
                    paired: state === 'connected' ? true : t.paired,
                    errorMessage: state === 'error' ? message : undefined,
                  }
                : t
            )
          );

          if (state === 'pairing_prompt') {
            setPairingPending(true);
            triggerNotification(
              '🔔 ¡Mira tu TV LG! Presiona "Aceptar" en la pantalla para permitir el control.'
            );
          } else if (state === 'pin_required') {
            setPairingPending(true);
            triggerNotification(
              '🔔 ¡Mira tu TV LG! Apareció un código PIN. Ingrésalo para vincular.'
            );
          } else if (state === 'connected') {
            setPairingPending(false);
            triggerNotification(`¡Conectado exitosamente con ${activeTV.name}!`);
            playSuccessBeep();
          } else if (state === 'error') {
            setPairingPending(false);
          }
        },
        activeTV.pairingMode || 'PROMPT'
      );
    } else {
      // Virtual simulated TV
      setActiveTV((prev) => ({
        ...prev,
        connectionState: 'connected',
        paired: true,
      }));
    }

    try {
      localStorage.setItem(LAST_ACTIVE_TV_KEY, activeTV.id);
    } catch {}
  }, [activeTV.id, activeTV.ip, activeTV.isPhysical]);

  const triggerNotification = (text: string) => {
    setNotificationBanner(text);
    setTimeout(() => {
      setNotificationBanner(null);
    }, 3800);
  };

  // Master command handler executed by remote buttons or voice assistant
  const handleSendCommand = (command: string, value?: any) => {
    // 1. Send to Physical TV via webOS SSAP if activeTV is physical
    if (activeTV.isPhysical) {
      switch (command) {
        case 'POWER_ON':
          if (activeTV.mac) {
            handleSendWakeOnLan(activeTV.mac);
          } else {
            triggerNotification('Para encender el TV apagado, ingresa su dirección MAC en Wi-Fi.');
          }
          break;

        case 'POWER_OFF':
          activeWebOSClient.turnOff();
          triggerNotification(`Comando apagar enviado a ${activeTV.name}`);
          break;

        case 'VOLUME_UP':
          activeWebOSClient.volumeUp();
          break;

        case 'VOLUME_DOWN':
          activeWebOSClient.volumeDown();
          break;

        case 'SET_VOLUME':
          if (typeof value === 'number') {
            activeWebOSClient.setVolume(value);
          }
          break;

        case 'MUTE_TOGGLE':
          activeWebOSClient.setMute(!tvState.isMuted);
          break;

        case 'CHANNEL_UP':
          activeWebOSClient.channelUp();
          break;

        case 'CHANNEL_DOWN':
          activeWebOSClient.channelDown();
          break;

        case 'SET_CHANNEL':
          if (value !== undefined) {
            activeWebOSClient.sendCommand('tv/openChannel', { channelNumber: String(value) });
          }
          break;

        case 'LAUNCH_APP':
          if (typeof value === 'string') {
            const appId = getAppIdFromKey(value);
            activeWebOSClient.openApp(appId);
            triggerNotification(`Iniciando ${value.toUpperCase()} en TV físico`);
          }
          break;

        case 'SWITCH_INPUT':
          if (typeof value === 'string') {
            const inputId = value.toUpperCase().replace('HDMI', 'HDMI_');
            activeWebOSClient.switchInput(inputId);
            triggerNotification(`Entrada cambiada a ${value.toUpperCase()} en TV`);
          }
          break;

        case 'NAVIGATE':
          activeWebOSClient.sendKey(value);
          break;

        case 'PLAY':
          activeWebOSClient.play();
          triggerNotification('Reproducir (Play) enviado a TV');
          break;

        case 'PAUSE':
          activeWebOSClient.pause();
          triggerNotification('Pausar enviado a TV');
          break;

        case 'STOP':
          activeWebOSClient.stop();
          triggerNotification('Detener enviado a TV');
          break;

        case 'REWIND':
          activeWebOSClient.rewind();
          break;

        case 'FAST_FORWARD':
          activeWebOSClient.fastForward();
          break;

        default:
          break;
      }

      // Log/audit via server route
      fetch('/api/tv/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, value, ip: activeTV.ip }),
      }).catch(() => {});
    }

    // 2. Mirror action on on-screen virtual TV state for instant tactile feedback
    switch (command) {
      case 'POWER_ON':
        setTvState((prev) => ({ ...prev, power: 'on' }));
        if (!activeTV.isPhysical) {
          triggerNotification(`Encendido Wake-on-LAN enviado a ${activeTV.name}`);
          playSuccessBeep();
        }
        break;

      case 'POWER_OFF':
        setTvState((prev) => ({ ...prev, power: 'off', showLauncher: false, sleepTimer: null }));
        if (!activeTV.isPhysical) {
          triggerNotification(`Comando webOS turnOff enviado a ${activeTV.name}`);
        }
        break;

      case 'VOLUME_UP':
        setTvState((prev) => ({
          ...prev,
          volume: clampVolume(prev.volume, 1),
          isMuted: false,
        }));
        break;

      case 'VOLUME_DOWN':
        setTvState((prev) => ({
          ...prev,
          volume: clampVolume(prev.volume, -1),
          isMuted: false,
        }));
        break;

      case 'SET_VOLUME':
        if (typeof value === 'number') {
          setTvState((prev) => ({
            ...prev,
            volume: clampVolume(value, 0),
            isMuted: false,
          }));
          triggerNotification(`Volumen fijado en ${value}%`);
        }
        break;

      case 'MUTE_TOGGLE':
        setTvState((prev) => ({
          ...prev,
          isMuted: !prev.isMuted,
        }));
        triggerNotification(tvState.isMuted ? 'Sonido activado' : 'Silencio (Mute) activado');
        break;

      case 'CHANNEL_UP':
        setTvState((prev) => {
          const nextCh = prev.channel.major >= 999 ? 1 : prev.channel.major + 1;
          return {
            ...prev,
            channel: { major: nextCh, name: `Canal ${nextCh} HD` },
          };
        });
        break;

      case 'CHANNEL_DOWN':
        setTvState((prev) => {
          const prevCh = prev.channel.major <= 1 ? 999 : prev.channel.major - 1;
          return {
            ...prev,
            channel: { major: prevCh, name: `Canal ${prevCh} HD` },
          };
        });
        break;

      case 'SET_CHANNEL':
        if (typeof value === 'number') {
          const safeCh = Math.max(1, Math.min(999, value));
          setTvState((prev) => ({
            ...prev,
            channel: { major: safeCh, name: `Canal ${safeCh} HD` },
          }));
          triggerNotification(`Sintonizando canal ${safeCh}`);
        }
        break;

      case 'LAUNCH_APP':
        if (typeof value === 'string') {
          setTvState((prev) => ({
            ...prev,
            activeApp: value,
            showLauncher: false,
            power: 'on',
          }));
          if (!activeTV.isPhysical) {
            triggerNotification(`Iniciando aplicación ${value.toUpperCase()} en TV`);
          }
        }
        break;

      case 'SWITCH_INPUT':
        if (typeof value === 'string') {
          setTvState((prev) => ({
            ...prev,
            activeInput: value as InputSource,
            activeApp: null,
            power: 'on',
          }));
          if (!activeTV.isPhysical) {
            triggerNotification(`Entrada cambiada a ${value.toUpperCase()}`);
          }
        }
        break;

      case 'SET_PICTURE_MODE':
        if (typeof value === 'string') {
          setTvState((prev) => ({
            ...prev,
            pictureMode: value as PictureMode,
          }));
          triggerNotification(`Modo de Imagen: ${value.toUpperCase()}`);
        }
        break;

      case 'CYCLE_PICTURE_MODE': {
        const modes: PictureMode[] = ['cinema', 'game', 'filmmaker', 'vivid', 'standard'];
        setTvState((prev) => {
          const nextIndex = (modes.indexOf(prev.pictureMode) + 1) % modes.length;
          const nextMode = modes[nextIndex];
          triggerNotification(`Modo de Imagen: ${nextMode.toUpperCase()}`);
          return { ...prev, pictureMode: nextMode };
        });
        break;
      }

      case 'MOVE_POINTER':
        if (value && typeof value.x === 'number' && typeof value.y === 'number') {
          setTvState((prev) => ({
            ...prev,
            pointer: { x: value.x, y: value.y, visible: true },
          }));
        }
        break;

      case 'NAVIGATE':
        if (value === 'HOME') {
          setTvState((prev) => ({
            ...prev,
            showLauncher: !prev.showLauncher,
            power: 'on',
          }));
        } else if (value === 'BACK') {
          setTvState((prev) => ({
            ...prev,
            showLauncher: false,
            activeApp: prev.activeApp ? null : prev.activeApp,
          }));
        } else if (value === 'EXIT') {
          setTvState((prev) => ({
            ...prev,
            showLauncher: false,
            activeApp: null,
          }));
        }
        break;

      case 'MEDIA_PLAY':
        triggerNotification('Reproduciendo contenido en TV');
        break;

      case 'MEDIA_PAUSE':
        triggerNotification('Contenido pausado en TV');
        break;

      case 'SET_SLEEP_TIMER': {
        const mins = typeof value === 'number' ? value : 30;
        setTvState((prev) => ({
          ...prev,
          sleepTimer: {
            minutes: mins,
            remainingSeconds: mins * 60,
          },
        }));
        triggerNotification(`Temporizador configurado: Apagado en ${mins} minutos`);
        playSuccessBeep();
        break;
      }

      case 'CANCEL_SLEEP_TIMER':
        setTvState((prev) => ({
          ...prev,
          sleepTimer: null,
        }));
        triggerNotification('Temporizador de apagado cancelado');
        break;

      default:
        break;
    }
  };

  // Add a physical TV by IP & Name
  const handleAddPhysicalTV = (ip: string, name: string, mac?: string) => {
    const cleanIp = ip.trim();
    const id = `physical-${cleanIp.replace(/\./g, '-')}`;
    const newTV: DiscoveredTV = {
      id,
      name: name.trim() || `LG Smart TV (${cleanIp})`,
      model: 'LG webOS Smart TV',
      ip: cleanIp,
      mac: mac ? mac.trim() : '',
      port: 3001,
      webOSVersion: 'webOS',
      paired: false,
      pairingPin: '123456',
      signalStrength: 92,
      isPhysical: true,
      connectionState: 'connecting',
    };

    setAvailableTVs((prev) => {
      const filtered = prev.filter((t) => t.ip !== cleanIp);
      const updated = [newTV, ...filtered];
      try {
        localStorage.setItem(
          SAVED_TVS_KEY,
          JSON.stringify(updated.filter((t) => t.isPhysical))
        );
      } catch {}
      return updated;
    });

    setActiveTV(newTV);
    triggerNotification(`TV físico configurado (${cleanIp}). Conectando...`);
  };

  const handleRemoveTV = (id: string) => {
    setAvailableTVs((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      try {
        localStorage.setItem(
          SAVED_TVS_KEY,
          JSON.stringify(updated.filter((t) => t.isPhysical))
        );
      } catch {}
      return updated;
    });

    if (activeTV.id === id) {
      const fallback = availableTVs.find((t) => t.id !== id) || DEFAULT_TVS[0];
      setActiveTV(fallback);
    }
  };

  // Pairing requests
  const handleRequestPairing = (tv: DiscoveredTV, mode: 'PROMPT' | 'PIN' = 'PROMPT') => {
    setActiveTV({ ...tv, pairingMode: mode });
    if (tv.isPhysical) {
      activeWebOSClient.clearSavedClientKey(tv.ip);
      activeWebOSClient.connect(
        tv.ip,
        (state, message) => {
          setActiveTV((prev) => ({ ...prev, connectionState: state, errorMessage: message }));
        },
        mode,
        true
      );
      triggerNotification(`Solicitud de vinculación enviada (${mode}) a ${tv.ip}`);
    } else {
      setPairingPending(true);
      triggerNotification(`Código PIN enviado a la pantalla simulada de ${tv.name}`);
    }
  };

  const handleConfirmPin = async (pin: string): Promise<boolean> => {
    if (activeTV.isPhysical) {
      triggerNotification(`Enviando código PIN al TV ${activeTV.name}...`);
      const success = await activeWebOSClient.sendPin(pin);
      if (success) {
        setPairingPending(false);
        setAvailableTVs((prev) =>
          prev.map((t) => (t.id === activeTV.id ? { ...t, paired: true, connectionState: 'connected' } : t))
        );
        setActiveTV((prev) => ({ ...prev, paired: true, connectionState: 'connected' }));
        triggerNotification(`¡Dispositivo vinculado exitosamente con ${activeTV.name}!`);
        playSuccessBeep();
        return true;
      } else {
        triggerNotification('Código PIN incorrecto o expirado. Revisa la pantalla de tu TV.');
        return false;
      }
    } else {
      const isCorrect = verifyPairingPin(pin, activeTV.pairingPin);
      if (isCorrect) {
        setPairingPending(false);
        setAvailableTVs((prev) =>
          prev.map((t) => (t.id === activeTV.id ? { ...t, paired: true } : t))
        );
        setActiveTV((prev) => ({ ...prev, paired: true }));
        triggerNotification(`¡Dispositivo vinculado exitosamente con ${activeTV.name}!`);
        return true;
      }
      return false;
    }
  };

  const handleSendWakeOnLan = async (mac: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/tv/wol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac }),
      });
      if (res.ok) {
        setTvState((prev) => ({ ...prev, power: 'on' }));
        triggerNotification(`Wake-on-LAN: Paquete mágico emitido a ${mac}. TV encendiendo.`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        {/* Brand wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-700 flex items-center justify-center text-white font-black text-sm shadow-md shadow-rose-600/30">
            LG
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            ThinQ Smart Remote
          </span>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <button
            onClick={() => setIsDeviceScannerOpen(true)}
            className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Wifi className="w-3.5 h-3.5 text-rose-500" />
            <span>Vincular TV Físico / Wi-Fi</span>
          </button>
          <button
            onClick={() => handleSendCommand('NAVIGATE', 'HOME')}
            className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            webOS Home
          </button>
          <button
            onClick={() => handleSendCommand('CYCLE_PICTURE_MODE')}
            className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            Calibración de Imagen
          </button>
          <button
            onClick={() => setIsGeminiModalOpen(true)}
            className="hover:text-rose-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 text-rose-300"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Asistente Gemini</span>
          </button>
          <button
            onClick={() => setIsPythonModalOpen(true)}
            className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 text-emerald-300 font-semibold"
          >
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800">Py</span>
            <span>Código Python</span>
          </button>
          <button
            onClick={() => setIsKotlinModalOpen(true)}
            className="hover:text-indigo-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 text-indigo-300 font-semibold"
            title="Módulo nativo en Kotlin para Android Studio"
          >
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">Kt</span>
            <span>Nativo Kotlin</span>
          </button>
          <button
            onClick={() => setIsInstallModalOpen(true)}
            className="hover:text-teal-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 text-teal-300 font-semibold"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Descargar / PWA</span>
          </button>
        </nav>

        {/* Action button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton onOpenModal={() => setIsInstallModalOpen(true)} />

          <button
            onClick={() => setShowTVPreviewModal(true)}
            className="lg:hidden px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 flex items-center gap-1.5"
          >
            <Tv className="w-3.5 h-3.5 text-rose-500" />
            <span>Ver Pantalla TV</span>
          </button>

          <button
            onClick={() => setIsDeviceScannerOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-md shadow-rose-600/20 whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>{activeTV.isPhysical ? 'Cambiar TV Físico' : 'Conectar TV Físico'}</span>
          </button>
        </div>
      </header>

      {/* Urgent Prompt Banner if TV is asking for confirmation on screen */}
      {activeTV.connectionState === 'pairing_prompt' && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center justify-between sticky top-14 z-30 shadow-lg animate-pulse">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <span className="text-base">🔔</span>
            <span className="flex-1">
              <strong>¡ACCIÓN EN TU TELEVISOR LG!</strong> Apareció un mensaje pidiendo permiso para conectar. Toma el control de tu televisor y pulsa <strong>"Aceptar"</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Urgent PIN Prompt Banner if TV is showing PIN code */}
      {activeTV.connectionState === 'pin_required' && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center justify-between sticky top-14 z-30 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2">
              <span className="text-base">🔑</span>
              <span>
                <strong>¡CÓDIGO PIN EN PANTALLA!</strong> Tu televisor LG está mostrando un código PIN de vinculación.
              </span>
            </div>
            <button
              onClick={() => setIsDeviceScannerOpen(true)}
              className="px-3 py-1 bg-slate-950 text-white rounded-lg font-bold text-xs hover:bg-slate-900 transition-colors"
            >
              Ingresar PIN en la App
            </button>
          </div>
        </div>
      )}

      {/* SSL Error Helper Banner if Chrome blocked port 3001 */}
      {activeTV.isPhysical && activeTV.connectionState === 'error' && (
        <div className="bg-rose-950/95 border-b border-rose-800 text-rose-200 px-4 py-2.5 text-xs sticky top-14 z-30 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                ¿Viste <strong>"hello world"</strong> en el puerto 3000? Tu TV está online, pero Chrome bloquea la conexión local desde esta web HTTPS.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => downloadStandaloneRemote(activeTV.ip, activeTV.name)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
                title="Descarga el control local para abrirlo en tu celular o PC sin restricciones de SSL"
              >
                <Download className="w-3 h-3" />
                <span>Descargar Control Local (.html)</span>
              </button>
              <a
                href={`https://${activeTV.ip}:3001`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Habilitar SSL en https://{activeTV.ip}:3001</span>
              </a>
              <button
                onClick={() => setIsDeviceScannerOpen(true)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Opciones
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Notification Toast Banner */}
      {notificationBanner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900/95 border border-rose-500/50 backdrop-blur-md rounded-2xl shadow-xl shadow-rose-950/20 text-xs font-medium text-slate-200 flex items-center gap-2 animate-in slide-in-from-top duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notificationBanner}</span>
        </div>
      )}

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* COLUMN 1: Android Smartphone Remote */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Control Android LG ThinQ
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeTV.connectionState === 'connected'
                      ? 'bg-emerald-500'
                      : activeTV.connectionState === 'pairing_prompt'
                      ? 'bg-amber-400 animate-ping'
                      : activeTV.connectionState === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-500'
                  }`}
                />
                <span className="font-mono">
                  {activeTV.isPhysical ? `TV Físico: ${activeTV.ip}` : 'Simulador Demo'}
                </span>
              </div>
            </div>

            {/* Android Device Frame */}
            <AndroidPhoneFrame isStandaloneMobile={isMobileScreen}>
              <RemoteControlPad
                tvState={tvState}
                activeTV={activeTV}
                onSendCommand={handleSendCommand}
                onOpenDeviceScanner={() => setIsDeviceScannerOpen(true)}
                onOpenGeminiAssistant={() => setIsGeminiModalOpen(true)}
                onOpenAppLauncher={() => handleSendCommand('NAVIGATE', 'HOME')}
              />
            </AndroidPhoneFrame>
          </div>

          {/* COLUMN 2: Virtual LG OLED TV & Copilot Telemetry */}
          <div className="hidden lg:flex lg:col-span-7 flex-col space-y-6 sticky top-20">
            {/* TV Screen */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Tv className="w-5 h-5 text-rose-500" />
                  <h2 className="text-sm font-bold text-slate-200">
                    {activeTV.isPhysical
                      ? `Controlando TV Físico: ${activeTV.name}`
                      : 'Simulador LG OLED TV en Tiempo Real'}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {activeTV.isPhysical ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      ● Transmitiendo comandos webOS en vivo
                    </span>
                  ) : (
                    <span>Responde instantáneamente a cada botón del control</span>
                  )}
                </div>
              </div>

              <VirtualLGOledTV
                tvState={tvState}
                activeTV={activeTV}
                pairingPending={pairingPending}
                onConfirmPairing={() => handleConfirmPin(activeTV.pairingPin)}
              />
            </div>

            {/* TV Specs & Gemini Copilot Quick Banner */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>Estado del Televisor</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>Dispositivo:</span>
                    <span className="text-rose-400 font-bold truncate max-w-[150px]">
                      {activeTV.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dirección IP:</span>
                    <span className="text-slate-200 font-bold">{activeTV.ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Alimentación:</span>
                    <span className={tvState.power === 'on' ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {tvState.power.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volumen:</span>
                    <span className="text-rose-400 font-bold">{tvState.isMuted ? 'MUTE' : `${tvState.volume}%`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Temporizador:</span>
                    <span className={tvState.sleepTimer ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                      {tvState.sleepTimer ? formatRemainingTime(tvState.sleepTimer.remainingSeconds) : 'Desactivado'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-rose-950/30 to-purple-950/30 border border-rose-900/40 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-300 mb-1">
                    <Sparkles className="w-4 h-4 text-rose-400" />
                    <span>Asistente IA con Gemini</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-snug">
                    Usa modelos Gemini para dictar comandos por voz, controlar tu TV físico y analizar la pantalla con <span className="font-mono text-purple-300">gemini-4-argon</span>.
                  </p>
                </div>
                <button
                  onClick={() => setIsGeminiModalOpen(true)}
                  className="mt-3 w-full py-2 px-3 bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Abrir Asistente IA</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Modal for TV Preview */}
      {showTVPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/90 p-4 flex flex-col justify-center animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <span className="text-sm font-bold text-white">Pantalla LG TV en Vivo</span>
            <button
              onClick={() => setShowTVPreviewModal(false)}
              className="px-3 py-1 bg-slate-800 text-xs rounded-lg text-slate-300"
            >
              Cerrar
            </button>
          </div>
          <VirtualLGOledTV
            tvState={tvState}
            activeTV={activeTV}
            pairingPending={pairingPending}
            onConfirmPairing={() => handleConfirmPin(activeTV.pairingPin)}
          />
        </div>
      )}

      {/* Device Scanner Modal */}
      <DeviceScannerModal
        isOpen={isDeviceScannerOpen}
        onClose={() => setIsDeviceScannerOpen(false)}
        activeTV={activeTV}
        availableTVs={availableTVs}
        onSelectTV={(tv) => {
          setActiveTV(tv);
          triggerNotification(`Seleccionado ${tv.name}`);
        }}
        onAddPhysicalTV={handleAddPhysicalTV}
        onRemoveTV={handleRemoveTV}
        onRequestPairing={handleRequestPairing}
        onConfirmPin={handleConfirmPin}
        onSendWakeOnLan={handleSendWakeOnLan}
      />

      {/* Gemini Assistant Modal */}
      <GeminiAssistantModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        tvState={tvState}
        onExecuteCommand={handleSendCommand}
      />

      {/* Python Export & Android Guide Modal */}
      <PythonExportModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
        activeIp={activeTV.ip}
        activeMac={activeTV.mac}
      />

      {/* Kotlin Native Module Modal */}
      <KotlinExportModal
        isOpen={isKotlinModalOpen}
        onClose={() => setIsKotlinModalOpen(false)}
        activeIp={activeTV.ip}
        activeMac={activeTV.mac}
      />

      {/* Android Install & APK Guide Modal */}
      <AndroidInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500">
        <p>LG ThinQ Smart Remote · Conexión WebSocket SSAP directa a televisores LG webOS 4.0 – 24 · Control Wi-Fi & Wake-On-LAN</p>
      </footer>
    </div>
  );
}

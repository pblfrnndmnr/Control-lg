import React, { useState } from 'react';
import {
  Power,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  RotateCcw,
  Sliders,
  Tv,
  Wifi,
  MousePointer,
  Sparkles,
  Play,
  Pause,
  Grid,
  Hash,
  X,
  CornerDownLeft,
  Timer,
} from 'lucide-react';
import type { TVState, DiscoveredTV, InputSource } from '../types.ts';
import { playHapticClick } from '../utils/audioFeedback.ts';
import { formatRemainingTime } from '../utils/tvProtocol.ts';

interface RemoteControlPadProps {
  tvState: TVState;
  activeTV: DiscoveredTV;
  onSendCommand: (command: string, value?: any) => void;
  onOpenDeviceScanner: () => void;
  onOpenGeminiAssistant: () => void;
  onOpenAppLauncher: () => void;
}

export const RemoteControlPad: React.FC<RemoteControlPadProps> = ({
  tvState,
  activeTV,
  onSendCommand,
  onOpenDeviceScanner,
  onOpenGeminiAssistant,
  onOpenAppLauncher,
}) => {
  const [activeTab, setActiveTab] = useState<'remote' | 'touchpad' | 'apps'>('remote');
  const [showNumPad, setShowNumPad] = useState(false);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [showInputSelector, setShowInputSelector] = useState(false);
  const [enteredDigits, setEnteredDigits] = useState('');

  const handlePress = (cmd: string, val?: any, freq = 600) => {
    playHapticClick(freq);
    onSendCommand(cmd, val);
  };

  const handleDigit = (digit: string) => {
    playHapticClick(750);
    const updated = (enteredDigits + digit).slice(0, 4);
    setEnteredDigits(updated);
  };

  const handleSendChannel = () => {
    if (!enteredDigits) return;
    const ch = parseInt(enteredDigits, 10);
    if (!isNaN(ch)) {
      handlePress('SET_CHANNEL', ch, 800);
      setEnteredDigits('');
      setShowNumPad(false);
    }
  };

  // Touchpad cursor handling
  const handleTouchpadMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const relX = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    const relY = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));

    onSendCommand('MOVE_POINTER', { x: Math.round(relX), y: Math.round(relY) });
  };

  const isPowerOn = tvState.power === 'on';

  return (
    <div className="flex-1 flex flex-col p-4 bg-slate-950 text-slate-100 select-none pb-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800/80">
        {/* TV Status Pill */}
        <button
          onClick={onOpenDeviceScanner}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors text-left max-w-[210px]"
          title="Toca para cambiar o vincular televisor"
        >
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              activeTV.connectionState === 'connected' || (activeTV.paired && isPowerOn)
                ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                : activeTV.connectionState === 'pairing_prompt' || activeTV.connectionState === 'pin_required'
                ? 'bg-amber-400 animate-ping'
                : activeTV.connectionState === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : activeTV.connectionState === 'error'
                ? 'bg-rose-500'
                : 'bg-slate-500'
            }`}
          />
          <div className="flex flex-col truncate">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-semibold text-slate-200 truncate">{activeTV.name}</span>
              {activeTV.isPhysical && (
                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 shrink-0">
                  Físico
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono truncate">
              {activeTV.connectionState === 'pairing_prompt'
                ? '⚠️ ACEPTAR EN TV'
                : activeTV.connectionState === 'pin_required'
                ? '🔑 INGRESAR PIN'
                : activeTV.connectionState === 'connecting'
                ? 'Conectando...'
                : activeTV.connectionState === 'error'
                ? 'Sin respuesta'
                : activeTV.ip}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {/* Input Source Button */}
          <button
            onClick={() => setShowInputSelector(!showInputSelector)}
            className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 active:scale-95 transition-transform"
            aria-label="Cambiar entrada HDMI"
          >
            <Tv className="w-4 h-4 text-slate-300" />
          </button>

          {/* Wi-Fi Devices */}
          <button
            onClick={onOpenDeviceScanner}
            className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 active:scale-95 transition-transform"
            aria-label="Buscar televisores en Wi-Fi"
          >
            <Wifi className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Master Power Button */}
          <button
            onClick={() => handlePress(isPowerOn ? 'POWER_OFF' : 'POWER_ON', undefined, isPowerOn ? 400 : 700)}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 ${
              isPowerOn
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-rose-500 border border-rose-500/30'
            }`}
            aria-label={isPowerOn ? 'Apagar televisor LG' : 'Encender televisor LG (Wake-on-LAN)'}
          >
            <Power className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Input Selector Dropdown Overlay */}
      {showInputSelector && (
        <div className="mb-3 p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>SELECCIONAR ENTRADA</span>
            <button onClick={() => setShowInputSelector(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'hdmi1', label: 'HDMI 1' },
                { id: 'hdmi2', label: 'HDMI 2 (eARC)' },
                { id: 'hdmi3', label: 'HDMI 3' },
                { id: 'hdmi4', label: 'HDMI 4' },
                { id: 'livetv', label: 'TV en Vivo' },
                { id: 'av', label: 'AV Componente' },
              ] as { id: InputSource; label: string }[]
            ).map((inp) => (
              <button
                key={inp.id}
                onClick={() => {
                  handlePress('SWITCH_INPUT', inp.id);
                  setShowInputSelector(false);
                }}
                className={`py-2 px-2 text-xs rounded-xl font-medium transition-colors text-center ${
                  tvState.activeInput === inp.id
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {inp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mode Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 mb-4">
        <button
          onClick={() => {
            playHapticClick(500);
            setActiveTab('remote');
          }}
          className={`py-2 text-xs font-medium rounded-xl transition-all ${
            activeTab === 'remote' ? 'bg-slate-800 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Control
        </button>
        <button
          onClick={() => {
            playHapticClick(500);
            setActiveTab('touchpad');
          }}
          className={`py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeTab === 'touchpad' ? 'bg-slate-800 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>Puntero</span>
        </button>
        <button
          onClick={() => {
            playHapticClick(500);
            setActiveTab('apps');
          }}
          className={`py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeTab === 'apps' ? 'bg-slate-800 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Apps</span>
        </button>
        <button
          onClick={onOpenGeminiAssistant}
          className="py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1 bg-gradient-to-r from-rose-600/20 to-purple-600/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50"
        >
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-semibold">Voz / IA</span>
        </button>
      </div>

      {/* TAB 1: STANDARD REMOTE CONTROL VIEW */}
      {activeTab === 'remote' && (
        <div className="flex-1 flex flex-col justify-between space-y-4">
          {/* Volume, Channels & Mute Rockers */}
          <div className="grid grid-cols-3 gap-3 items-center">
            {/* VOL Rocker */}
            <div className="flex flex-col items-center bg-slate-900 border border-slate-800/90 rounded-3xl p-1.5 shadow-md">
              <button
                onClick={() => handlePress('VOLUME_UP', undefined, 650)}
                className="w-full h-12 rounded-2xl bg-slate-800/70 hover:bg-slate-700/80 active:bg-slate-600 flex items-center justify-center text-white active:scale-95 transition-transform"
                aria-label="Subir volumen"
              >
                <Plus className="w-5 h-5 text-slate-200" />
              </button>
              <div className="py-2 flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">VOL</span>
                <span className="text-sm font-mono font-bold text-rose-400 tabular-nums">
                  {tvState.isMuted ? 'MUT' : tvState.volume}
                </span>
              </div>
              <button
                onClick={() => handlePress('VOLUME_DOWN', undefined, 550)}
                className="w-full h-12 rounded-2xl bg-slate-800/70 hover:bg-slate-700/80 active:bg-slate-600 flex items-center justify-center text-white active:scale-95 transition-transform"
                aria-label="Bajar volumen"
              >
                <Minus className="w-5 h-5 text-slate-200" />
              </button>
            </div>

            {/* Center Utilities: MUTE, 123 Number Pad, Settings */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => handlePress('MUTE_TOGGLE', undefined, 500)}
                className={`h-11 rounded-2xl border flex items-center justify-center gap-1.5 text-xs font-semibold active:scale-95 transition-all ${
                  tvState.isMuted
                    ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-600/30'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
                aria-label="Silenciar / Quitar silencio"
              >
                {tvState.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{tvState.isMuted ? 'MUTE' : 'Mute'}</span>
              </button>

              <button
                onClick={() => {
                  playHapticClick(600);
                  setShowNumPad(!showNumPad);
                  setShowSleepTimerModal(false);
                }}
                className={`h-11 rounded-2xl border flex items-center justify-center gap-1 text-xs font-semibold active:scale-95 transition-all ${
                  showNumPad
                    ? 'bg-slate-800 border-rose-500/50 text-rose-400'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
                aria-label="Teclado numérico de canales"
              >
                <Hash className="w-4 h-4" />
                <span>123</span>
              </button>

              <button
                onClick={() => {
                  playHapticClick(600);
                  setShowSleepTimerModal(!showSleepTimerModal);
                  setShowNumPad(false);
                }}
                className={`h-11 rounded-2xl border flex items-center justify-center gap-1.5 text-xs font-semibold active:scale-95 transition-all ${
                  tvState.sleepTimer
                    ? 'bg-amber-600/20 border-amber-500/80 text-amber-300 shadow-md shadow-amber-950/20'
                    : showSleepTimerModal
                    ? 'bg-slate-800 border-amber-500/50 text-amber-400'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
                aria-label="Temporizador de apagado"
              >
                <Timer className={`w-3.5 h-3.5 ${tvState.sleepTimer ? 'text-amber-400 animate-pulse' : ''}`} />
                <span className="font-mono text-[10px] truncate">
                  {tvState.sleepTimer ? formatRemainingTime(tvState.sleepTimer.remainingSeconds) : 'Timer'}
                </span>
              </button>

              <button
                onClick={() => handlePress('CYCLE_PICTURE_MODE', undefined, 600)}
                className="h-11 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center gap-1 text-[11px] font-medium text-slate-300 active:scale-95 transition-all"
                aria-label="Cambiar modo de imagen"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span className="capitalize">{tvState.pictureMode}</span>
              </button>
            </div>

            {/* CH Rocker */}
            <div className="flex flex-col items-center bg-slate-900 border border-slate-800/90 rounded-3xl p-1.5 shadow-md">
              <button
                onClick={() => handlePress('CHANNEL_UP', undefined, 650)}
                className="w-full h-12 rounded-2xl bg-slate-800/70 hover:bg-slate-700/80 active:bg-slate-600 flex items-center justify-center text-white active:scale-95 transition-transform"
                aria-label="Canal arriba"
              >
                <ChevronUp className="w-5 h-5 text-slate-200" />
              </button>
              <div className="py-2 flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CH</span>
                <span className="text-sm font-mono font-bold text-slate-200 tabular-nums">
                  {tvState.channel.major}
                </span>
              </div>
              <button
                onClick={() => handlePress('CHANNEL_DOWN', undefined, 550)}
                className="w-full h-12 rounded-2xl bg-slate-800/70 hover:bg-slate-700/80 active:bg-slate-600 flex items-center justify-center text-white active:scale-95 transition-transform"
                aria-label="Canal abajo"
              >
                <ChevronDown className="w-5 h-5 text-slate-200" />
              </button>
            </div>
          </div>

          {/* Number Pad Drawer (conditionally visible) */}
          {showNumPad && (
            <div className="p-3 bg-slate-900/95 border border-slate-800 rounded-3xl shadow-xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-xs text-slate-400">Canal directo:</span>
                <span className="font-mono text-base font-bold text-rose-400">{enteredDigits || '--'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleDigit(num)}
                    className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 font-mono font-bold text-sm text-white active:scale-95 transition-transform"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => setEnteredDigits('')}
                  className="h-10 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-400 active:scale-95"
                >
                  Borrar
                </button>
                <button
                  onClick={() => handleDigit('0')}
                  className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 font-mono font-bold text-sm text-white active:scale-95 transition-transform"
                >
                  0
                </button>
                <button
                  onClick={handleSendChannel}
                  className="h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-md shadow-rose-600/30"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  <span>Ir</span>
                </button>
              </div>
            </div>
          )}

          {/* Sleep Timer Drawer */}
          {showSleepTimerModal && (
            <div className="p-3.5 bg-slate-900/95 border border-slate-800 rounded-3xl shadow-xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Timer className="w-4 h-4" />
                  <span>TEMPORIZADOR DE APAGADO</span>
                </div>
                <button
                  onClick={() => setShowSleepTimerModal(false)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Cerrar temporizador"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {tvState.sleepTimer && (
                <div className="mb-2.5 p-2 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Apagado programado en:</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400 text-sm tabular-nums">
                    {formatRemainingTime(tvState.sleepTimer.remainingSeconds)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[30, 60, 90].map((mins) => {
                  const isActive = tvState.sleepTimer?.minutes === mins;
                  return (
                    <button
                      key={mins}
                      onClick={() => {
                        handlePress('SET_SLEEP_TIMER', mins, 700);
                        setShowSleepTimerModal(false);
                      }}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all active:scale-95 ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 border border-amber-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
                      }`}
                    >
                      <span className="font-bold text-sm">{mins}</span>
                      <span className="text-[10px] text-slate-300">minutos</span>
                    </button>
                  );
                })}
              </div>

              {tvState.sleepTimer && (
                <button
                  onClick={() => {
                    handlePress('CANCEL_SLEEP_TIMER', undefined, 500);
                    setShowSleepTimerModal(false);
                  }}
                  className="w-full mt-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-red-400 font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar temporizador</span>
                </button>
              )}
            </div>
          )}

          {/* LG Magic Remote Directional D-Pad & Wheel */}
          <div className="relative w-56 h-56 mx-auto my-1 flex items-center justify-center">
            {/* Outer D-Pad Ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-slate-800/90 via-slate-900 to-slate-900 border border-slate-700/80 shadow-2xl flex items-center justify-center">
              {/* UP */}
              <button
                onClick={() => handlePress('NAVIGATE', 'UP', 600)}
                className="absolute top-2 w-16 h-12 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-transform"
                aria-label="Navegar Arriba"
              >
                <ChevronUp className="w-7 h-7" />
              </button>

              {/* DOWN */}
              <button
                onClick={() => handlePress('NAVIGATE', 'DOWN', 600)}
                className="absolute bottom-2 w-16 h-12 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-transform"
                aria-label="Navegar Abajo"
              >
                <ChevronDown className="w-7 h-7" />
              </button>

              {/* LEFT */}
              <button
                onClick={() => handlePress('NAVIGATE', 'LEFT', 600)}
                className="absolute left-2 h-16 w-12 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-transform"
                aria-label="Navegar Izquierda"
              >
                <ChevronLeft className="w-7 h-7" />
              </button>

              {/* RIGHT */}
              <button
                onClick={() => handlePress('NAVIGATE', 'RIGHT', 600)}
                className="absolute right-2 h-16 w-12 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-transform"
                aria-label="Navegar Derecha"
              >
                <ChevronRight className="w-7 h-7" />
              </button>

              {/* Center Wheel OK / Scroll Click */}
              <button
                onClick={() => handlePress('NAVIGATE', 'OK', 750)}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600/80 hover:border-rose-500/80 active:scale-90 shadow-inner flex flex-col items-center justify-center text-white transition-all group"
                aria-label="Botón OK / Seleccionar"
              >
                <span className="font-bold text-sm tracking-wide group-hover:text-rose-400">OK</span>
                <span className="text-[9px] text-slate-400 font-mono">Wheel</span>
              </button>
            </div>
          </div>

          {/* Core System Navigation: Back, Home (webOS), Exit */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handlePress('NAVIGATE', 'BACK', 550)}
              className="h-12 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 transition-all flex flex-col items-center justify-center text-slate-300 hover:text-white"
              aria-label="Atrás"
            >
              <RotateCcw className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-medium">Atrás</span>
            </button>

            <button
              onClick={() => handlePress('NAVIGATE', 'HOME', 680)}
              className="h-12 rounded-2xl bg-gradient-to-b from-rose-600/20 to-slate-900 border border-rose-500/40 hover:border-rose-500 active:scale-95 transition-all flex flex-col items-center justify-center text-rose-400 hover:text-rose-300"
              aria-label="Menú Inicio webOS"
            >
              <Home className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-bold">Home</span>
            </button>

            <button
              onClick={() => handlePress('NAVIGATE', 'EXIT', 550)}
              className="h-12 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 transition-all flex flex-col items-center justify-center text-slate-300 hover:text-white"
              aria-label="Salir"
            >
              <X className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-medium">Salir</span>
            </button>
          </div>

          {/* Quick App Streaming Access Buttons */}
          <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-900">
            <button
              onClick={() => handlePress('LAUNCH_APP', 'netflix')}
              className="h-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 font-black text-xs text-red-600 tracking-tight flex items-center justify-center active:scale-95 transition-transform"
            >
              NETFLIX
            </button>
            <button
              onClick={() => handlePress('LAUNCH_APP', 'youtube')}
              className="h-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 font-bold text-xs text-white flex items-center justify-center gap-1 active:scale-95 transition-transform"
            >
              <span className="text-red-500">▶</span>
              <span>YouTube</span>
            </button>
            <button
              onClick={() => handlePress('LAUNCH_APP', 'prime')}
              className="h-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 font-bold text-[11px] text-cyan-400 flex items-center justify-center active:scale-95 transition-transform"
            >
              prime
            </button>
            <button
              onClick={() => handlePress('LAUNCH_APP', 'disney')}
              className="h-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 font-bold text-[11px] text-blue-400 flex items-center justify-center active:scale-95 transition-transform"
            >
              Disney+
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: MAGIC REMOTE AIR-MOUSE TOUCHPAD */}
      {activeTab === 'touchpad' && (
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>PUNTERO MAGIC REMOTE</span>
            <span className="font-mono text-[11px] text-rose-400">
              {tvState.pointer.x}%, {tvState.pointer.y}%
            </span>
          </div>

          {/* Interactive Touch Surface */}
          <div
            onMouseMove={handleTouchpadMove}
            onTouchMove={handleTouchpadMove}
            onClick={() => handlePress('NAVIGATE', 'OK', 700)}
            className="flex-1 min-h-[300px] bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-dashed border-slate-800 hover:border-rose-500/50 rounded-3xl p-4 flex flex-col items-center justify-center text-center cursor-crosshair transition-colors active:border-rose-500 relative overflow-hidden"
          >
            {/* Visual Crosshair Grid */}
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3 pointer-events-none">
              <MousePointer className="w-6 h-6 animate-bounce" />
            </div>
            <p className="text-sm font-semibold text-slate-200 pointer-events-none">
              Superficie Táctil Magic Pointer
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-[220px] pointer-events-none">
              Desliza el dedo o cursor para apuntar en la pantalla de tu LG TV. Toca para hacer clic.
            </p>
          </div>

          {/* Quick Click & Scroll Bars */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handlePress('NAVIGATE', 'BACK', 550)}
              className="py-3 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium text-xs active:scale-95"
            >
              Atrás
            </button>
            <button
              onClick={() => handlePress('NAVIGATE', 'OK', 750)}
              className="py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 active:scale-95"
            >
              Clic (OK)
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: APP GALLERY */}
      {activeTab === 'apps' && (
        <div className="flex-1 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>APLICACIONES INSTALADAS</span>
            <span className="text-[11px] text-slate-500">webOS Store</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 overflow-y-auto max-h-[380px] pr-1">
            {[
              { id: 'netflix', name: 'Netflix', color: 'from-red-600 to-red-950', badge: 'Películas' },
              { id: 'youtube', name: 'YouTube', color: 'from-red-500 to-slate-900', badge: 'Videos' },
              { id: 'prime', name: 'Prime Video', color: 'from-cyan-600 to-slate-900', badge: 'Streaming' },
              { id: 'disney', name: 'Disney+', color: 'from-blue-600 to-blue-950', badge: 'Series' },
              { id: 'spotify', name: 'Spotify', color: 'from-emerald-500 to-black', badge: 'Música' },
              { id: 'appletv', name: 'Apple TV+', color: 'from-neutral-700 to-neutral-900', badge: 'Originals' },
              { id: 'twitch', name: 'Twitch', color: 'from-purple-600 to-purple-950', badge: 'Live' },
              { id: 'hbomax', name: 'Max (HBO)', color: 'from-blue-700 to-indigo-950', badge: 'Cine' },
              { id: 'lgchannels', name: 'LG Channels', color: 'from-rose-600 to-slate-900', badge: 'IPTV Gratis' },
              { id: 'browser', name: 'Navegador Web', color: 'from-slate-700 to-slate-900', badge: 'Internet' },
            ].map((app) => (
              <button
                key={app.id}
                onClick={() => handlePress('LAUNCH_APP', app.id)}
                className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 flex flex-col items-center text-center transition-all active:scale-95 group"
              >
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center font-bold text-white text-xs mb-2 shadow-md group-hover:scale-105 transition-transform`}
                >
                  {app.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-200 truncate w-full">{app.name}</span>
                <span className="text-[9px] text-slate-400 mt-0.5">{app.badge}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => handlePress('NAVIGATE', 'HOME')}
            className="w-full py-3 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-rose-400 font-semibold text-xs flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Abrir menú principal webOS</span>
          </button>
        </div>
      )}

      {/* Mini Playback Transport Bar */}
      <div className="mt-3 pt-3 border-t border-slate-900 flex items-center justify-between text-slate-400 px-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Reproducción</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handlePress('MEDIA_PLAY')}
            className="p-2 rounded-lg hover:bg-slate-900 text-slate-300 hover:text-white"
            aria-label="Reproducir"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={() => handlePress('MEDIA_PAUSE')}
            className="p-2 rounded-lg hover:bg-slate-900 text-slate-300 hover:text-white"
            aria-label="Pausa"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

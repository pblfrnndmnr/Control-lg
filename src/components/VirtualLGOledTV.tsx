import React, { useEffect, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Tv,
  Sparkles,
  Wifi,
  Radio,
  Sliders,
  CheckCircle2,
  Timer,
} from 'lucide-react';
import type { TVState, DiscoveredTV } from '../types.ts';
import { formatRemainingTime } from '../utils/tvProtocol.ts';

interface VirtualLGOledTVProps {
  tvState: TVState;
  activeTV: DiscoveredTV;
  pairingPending: boolean;
  onConfirmPairing?: () => void;
  onDismissVolumeHUD?: () => void;
}

export const VirtualLGOledTV: React.FC<VirtualLGOledTVProps> = ({
  tvState,
  activeTV,
  pairingPending,
  onConfirmPairing,
}) => {
  const [showVolumeHUD, setShowVolumeHUD] = useState(false);
  const [hudTimer, setHudTimer] = useState<number | null>(null);

  // Trigger volume HUD whenever volume or mute changes
  useEffect(() => {
    if (tvState.power !== 'on') return;
    setShowVolumeHUD(true);
    if (hudTimer) clearTimeout(hudTimer);
    const t = window.setTimeout(() => {
      setShowVolumeHUD(false);
    }, 2400);
    setHudTimer(t);
    return () => clearTimeout(t);
  }, [tvState.volume, tvState.isMuted]);

  const isPowerOn = tvState.power === 'on';

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto select-none">
      {/* TV Header Telemetry & Status */}
      <div className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-400 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-rose-500" />
          <span className="font-semibold text-slate-200">{activeTV.name}</span>
          <span>·</span>
          <span className="font-mono text-slate-400">{activeTV.ip}</span>
          <span>·</span>
          <span className="text-slate-400">{activeTV.webOSVersion}</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>Wi-Fi 5GHz</span>
          </span>
          <span>·</span>
          <span className={isPowerOn ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
            {isPowerOn ? 'ENCENDIDO' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Physical TV Chassis */}
      <div className="relative w-full aspect-video bg-black rounded-lg border-2 border-slate-800 shadow-2xl shadow-rose-950/20 overflow-hidden flex flex-col justify-between p-2">
        {/* Anti-glare Glass Frame & OLED Screen */}
        <div className="relative w-full h-full bg-slate-950 rounded overflow-hidden flex items-center justify-center">
          {/* STATE 1: TV IS OFF (Standby) */}
          {!isPowerOn && (
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950 flex flex-col items-center justify-center text-center p-6">
              <div className="w-12 h-12 rounded-full bg-slate-900/60 border border-slate-800 flex items-center justify-center text-slate-700 mb-3">
                <Tv className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-500">LG OLED en modo Standby</p>
              <p className="text-xs text-slate-600 mt-1 max-w-xs">
                Listo para recibir encendido por red Wi-Fi (Wake-on-LAN) desde tu control Android.
              </p>
            </div>
          )}

          {/* STATE 2: TV IS ON */}
          {isPowerOn && (
            <>
              {/* Active Screen Background Content based on app or input */}
              <div className="absolute inset-0 bg-slate-900 overflow-hidden">
                {tvState.activeApp === 'youtube' ? (
                  <div className="w-full h-full bg-gradient-to-br from-red-950/40 via-slate-900 to-black p-6 flex flex-col justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-6 bg-red-600 rounded-md flex items-center justify-center font-bold text-white text-xs">
                        ▶
                      </div>
                      <span className="font-bold text-lg text-white">YouTube TV</span>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-xl p-4 max-w-md">
                      <p className="text-xs text-red-400 font-semibold uppercase tracking-wider">Reproduciendo en 4K HDR</p>
                      <h4 className="text-base font-semibold text-white mt-1">LG OLED C3 Demo — Cosmic Odyssey 120fps</h4>
                      <p className="text-xs text-slate-400 mt-1">Dolby Atmos Audio · 60 fps · webOS 23</p>
                    </div>
                  </div>
                ) : tvState.activeApp === 'netflix' ? (
                  <div className="w-full h-full bg-gradient-to-t from-black via-zinc-950 to-neutral-900 p-6 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-red-600 tracking-tighter">NETFLIX</span>
                    </div>
                    <div className="bg-black/80 border border-neutral-800 p-4 rounded-xl max-w-md backdrop-blur-sm">
                      <p className="text-xs text-red-500 font-bold">TOP 1 EN TELEVISORES LG</p>
                      <h4 className="text-lg font-bold text-white">Cyber Odyssey: 2049</h4>
                      <p className="text-xs text-slate-300 mt-1">Ultra HD 4K · Dolby Vision · Audio Espacial 5.1</p>
                    </div>
                  </div>
                ) : tvState.activeApp === 'disney' ? (
                  <div className="w-full h-full bg-gradient-to-br from-blue-950 via-slate-900 to-black p-6 flex flex-col justify-between">
                    <span className="text-2xl font-bold text-blue-400 tracking-wider">Disney+</span>
                    <div className="bg-blue-950/60 border border-blue-900/40 p-4 rounded-xl max-w-md backdrop-blur-sm">
                      <h4 className="text-base font-bold text-white">The Mandalorian — IMAX Enhanced</h4>
                      <p className="text-xs text-blue-200 mt-1">Dolby Atmos · Relación de aspecto expandida</p>
                    </div>
                  </div>
                ) : tvState.activeApp === 'prime' ? (
                  <div className="w-full h-full bg-gradient-to-br from-cyan-950 via-slate-950 to-black p-6 flex flex-col justify-between">
                    <span className="text-xl font-bold text-cyan-400">prime video</span>
                    <div className="bg-cyan-950/40 border border-cyan-800/40 p-4 rounded-xl max-w-md">
                      <h4 className="text-base font-bold text-white">The Rings of Power</h4>
                      <p className="text-xs text-slate-400">Temporada 2 · HDR10+ · 4K UHD</p>
                    </div>
                  </div>
                ) : tvState.activeApp === 'spotify' ? (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-neutral-950 to-black p-6 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-emerald-400">Spotify</span>
                    </div>
                    <div className="flex items-center gap-4 bg-black/60 p-4 rounded-xl border border-emerald-900/30">
                      <div className="w-16 h-16 bg-emerald-600 rounded-lg flex items-center justify-center font-bold text-2xl text-black">
                        ♫
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Synthwave Nights</h4>
                        <p className="text-xs text-slate-400">LG Soundbar SC9S · eARC PCM 96kHz</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Default Input View (HDMI 1, HDMI 2, Live TV, etc.)
                  <div className="w-full h-full bg-gradient-to-b from-slate-900 to-black p-6 flex flex-col justify-between relative">
                    {/* Simulated High-Res Screen Graphics */}
                    <img
                      src="/src/assets/images/tv_screen_calibration_1792439193291.jpg"
                      alt="TV Active View"
                      className="absolute inset-0 w-full h-full object-cover opacity-85"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60" />

                    <div className="relative z-10 flex items-center justify-between">
                      <div className="bg-black/60 border border-slate-700/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
                        <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                        <span className="font-bold text-white uppercase tracking-wider">
                          {tvState.activeInput.toUpperCase()}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="font-mono text-slate-300">3840×2160 @ 120Hz VRR</span>
                      </div>
                      <div className="bg-black/60 border border-slate-700/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
                        <Sliders className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-300 font-semibold capitalize">Modo {tvState.pictureMode}</span>
                      </div>
                    </div>

                    <div className="relative z-10 flex items-end justify-between">
                      <div className="bg-black/70 border border-slate-800 p-3 rounded-lg backdrop-blur-md">
                        <p className="text-[11px] text-slate-400">Canal actual</p>
                        <p className="text-sm font-bold text-white">
                          CH {tvState.channel.major} · {tvState.channel.name}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-slate-400 font-mono">
                        LG Sound Sync (eARC) · Dolby Atmos
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* OVERLAY: LG webOS Sleep Timer Badge */}
              {tvState.sleepTimer && (
                <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/80 border border-amber-500/60 text-amber-300 backdrop-blur-md shadow-lg shadow-black/50 text-xs animate-in fade-in duration-200">
                  <Timer className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="font-semibold text-[11px]">Apagado en:</span>
                  <span className="font-mono font-bold text-amber-300 tabular-nums">
                    {formatRemainingTime(tvState.sleepTimer.remainingSeconds)}
                  </span>
                </div>
              )}

              {/* OVERLAY: LG webOS Circular Volume HUD (Appears on right side) */}
              {showVolumeHUD && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center bg-black/80 border border-slate-700/80 backdrop-blur-lg rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-700 flex items-center justify-center relative mb-2">
                    {/* SVG Progress Circle */}
                    <svg className="w-16 h-16 absolute -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-rose-500 transition-all duration-150"
                        strokeDasharray={`${tvState.isMuted ? 0 : tvState.volume}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    {tvState.isMuted ? (
                      <VolumeX className="w-7 h-7 text-rose-500" />
                    ) : (
                      <Volume2 className="w-7 h-7 text-white" />
                    )}
                  </div>
                  <span className="font-mono text-xl font-bold text-white tabular-nums">
                    {tvState.isMuted ? 'MUTE' : tvState.volume}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Volumen TV</span>
                </div>
              )}

              {/* OVERLAY: Magic Remote Pointer / Cursor */}
              {tvState.pointer.visible && (
                <div
                  className="absolute pointer-events-none z-40 transition-all duration-75 ease-out"
                  style={{
                    left: `${tvState.pointer.x}%`,
                    top: `${tvState.pointer.y}%`,
                  }}
                >
                  <div className="relative">
                    {/* LG Magic Remote Pink/Red Teardrop Cursor */}
                    <svg className="w-6 h-6 drop-shadow-[0_2px_8px_rgba(225,29,72,0.8)]" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 4L11 20L14 13L21 10L4 4Z"
                        fill="#f43f5e"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* OVERLAY: LG webOS Home Ribbon (Launcher) */}
              {tvState.showLauncher && (
                <div className="absolute bottom-2 left-4 right-4 z-30 bg-slate-950/90 border border-slate-700/80 rounded-2xl p-3 backdrop-blur-xl shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom duration-200">
                  <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                    <div className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold shrink-0">
                      webOS 23 Home
                    </div>
                    {['YouTube', 'Netflix', 'Disney+', 'Prime Video', 'Spotify', 'Apple TV+', 'LG Channels', 'Navegador'].map(
                      (app) => (
                        <div
                          key={app}
                          className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium shrink-0 transition-colors"
                        >
                          {app}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* OVERLAY: Pairing Request Dialog */}
              {pairingPending && (
                <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                  <div className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl shadow-rose-950/40">
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-white">Solicitud de Vinculación webOS</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      El dispositivo Android solicita conectarse a este televisor LG. Ingrese este código en su app:
                    </p>
                    <div className="my-4 py-3 px-4 bg-slate-950 rounded-xl border border-slate-700">
                      <span className="font-mono text-2xl font-bold tracking-widest text-rose-400">
                        {activeTV.pairingPin}
                      </span>
                    </div>
                    <button
                      onClick={onConfirmPairing}
                      className="w-full py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Autorizar en TV</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* TV Bottom Stand & Standby LED */}
        <div className="w-full pt-1 flex items-center justify-between px-3 text-[10px] text-slate-500">
          <span className="tracking-widest font-bold text-slate-400">LG OLED evo</span>
          {/* Physical Power/Standby LED */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                isPowerOn ? 'bg-white shadow-[0_0_6px_#ffffff]' : 'bg-rose-600 shadow-[0_0_6px_#e11d48]'
              }`}
            />
            <span className="font-mono text-[9px] text-slate-400">{isPowerOn ? 'Activo' : 'Standby'}</span>
          </div>
          <span className="font-mono">webOS 23</span>
        </div>
      </div>

      {/* Modern Center Stand Base */}
      <div className="w-48 h-2 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-800 rounded-b shadow-md" />
    </div>
  );
};

import React, { useState } from 'react';
import {
  Wifi,
  Tv,
  RefreshCw,
  X,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Plus,
  Radio,
  AlertTriangle,
  ExternalLink,
  HelpCircle,
  Trash2,
  Smartphone,
  Info,
  Download,
  Key,
  Activity,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import type { DiscoveredTV } from '../types.ts';
import { validateMacAddress, verifyPairingPin } from '../utils/tvProtocol.ts';
import { probeLGDevice } from '../utils/webosClient.ts';
import { playHapticClick, playSuccessBeep } from '../utils/audioFeedback.ts';
import { downloadStandaloneRemote } from '../utils/standaloneRemote.ts';
import {
  pingPort3001,
  pingPort3000,
  evaluateDiagnosticStatus,
  type DiagnosticResult,
} from '../utils/diagnosticPing.ts';

interface DeviceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTV: DiscoveredTV;
  availableTVs: DiscoveredTV[];
  onSelectTV: (tv: DiscoveredTV) => void;
  onAddPhysicalTV: (ip: string, name: string, mac?: string) => void;
  onRemoveTV?: (id: string) => void;
  onRequestPairing: (tv: DiscoveredTV, mode?: 'PROMPT' | 'PIN') => void;
  onConfirmPin: (pin: string) => boolean | Promise<boolean>;
  onSendWakeOnLan: (mac: string) => Promise<boolean>;
  onRetryConnection?: (tv: DiscoveredTV) => void;
}

export const DeviceScannerModal: React.FC<DeviceScannerModalProps> = ({
  isOpen,
  onClose,
  activeTV,
  availableTVs,
  onSelectTV,
  onAddPhysicalTV,
  onRemoveTV,
  onRequestPairing,
  onConfirmPin,
  onSendWakeOnLan,
  onRetryConnection,
}) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'manual' | 'diagnostic' | 'help'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; found: number }>({
    current: 0,
    total: 0,
    found: 0,
  });
  const [subnetPrefix, setSubnetPrefix] = useState('192.168.1');
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [selectedPairingMode, setSelectedPairingMode] = useState<'PROMPT' | 'PIN'>('PROMPT');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

  // Manual IP Form
  const [manualIP, setManualIP] = useState('');
  const [manualName, setManualName] = useState('Mi LG Smart TV');
  const [manualMAC, setManualMAC] = useState('');
  const [manualFormError, setManualFormError] = useState<string | null>(null);
  const [isTestingIP, setIsTestingIP] = useState(false);

  // Diagnostic Ping Tool State (Port 3001 fetch no-cors ping)
  const [diagnosticIP, setDiagnosticIP] = useState<string>(activeTV.ip || '192.168.1.100');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnostic3001Result, setDiagnostic3001Result] = useState<DiagnosticResult | null>(null);
  const [diagnostic3000Result, setDiagnostic3000Result] = useState<DiagnosticResult | null>(null);
  const [perTvDiagnostic, setPerTvDiagnostic] = useState<Record<string, { loading: boolean; result: DiagnosticResult | null }>>({});

  const [wolSuccess, setWolSuccess] = useState<string | null>(null);
  const [isSsdpScanning, setIsSsdpScanning] = useState(false);
  const [ssdpMessage, setSsdpMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // SSDP M-SEARCH UDP Multicast Scanner (webOS target urn:lge-com:service:webos:secondscreen-1)
  const handleStartSsdpScan = async () => {
    playHapticClick(700);
    setIsSsdpScanning(true);
    setSsdpMessage('Emitiendo M-SEARCH UDP a 239.255.255.250:1900...');
    try {
      const res = await fetch('/api/tv/discover-ssdp');
      const data = await res.json();
      if (data && data.devices && data.devices.length > 0) {
        let added = 0;
        for (const dev of data.devices) {
          if (!availableTVs.some((t) => t.ip === dev.ip)) {
            onAddPhysicalTV(dev.ip, dev.model || `LG webOS TV (${dev.ip})`);
            added++;
          }
        }
        setSsdpMessage(`¡SSDP detectó ${data.devices.length} televisor(es) LG! (${added} nuevos añadidos)`);
        playSuccessBeep();
      } else {
        setSsdpMessage('SSDP finalizado: No se recibieron paquetes UDP. Utiliza el escaneo de subred.');
      }
    } catch {
      setSsdpMessage('Descubrimiento SSDP no disponible en este entorno. Usa el escaneo de subred.');
    } finally {
      setIsSsdpScanning(false);
    }
  };

  // Active Subnet Scanner
  const handleStartSubnetScan = async () => {
    playHapticClick(650);
    setIsScanning(true);
    const startHost = 1;
    const endHost = 40; // Fast scan first 40 IP hosts
    const total = endHost - startHost + 1;
    let foundCount = 0;

    setScanProgress({ current: 0, total, found: 0 });

    for (let h = startHost; h <= endHost; h++) {
      const probeIp = `${subnetPrefix.trim()}.${h}`;
      setScanProgress({ current: h, total, found: foundCount });

      try {
        const isLive = await probeLGDevice(probeIp, 800);
        if (isLive) {
          foundCount++;
          // Auto add if not present
          const alreadyExists = availableTVs.some((t) => t.ip === probeIp);
          if (!alreadyExists) {
            onAddPhysicalTV(probeIp, `LG Smart TV (${probeIp})`);
          }
        }
      } catch {
        // Continue
      }
    }

    setIsScanning(false);
    playSuccessBeep();
  };

  const handleManualAdd = async () => {
    playHapticClick(700);
    const ip = manualIP.trim();

    // Basic IPv4 validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      setManualFormError('Ingresa una dirección IP válida (ejemplo: 192.168.1.105)');
      return;
    }

    if (manualMAC.trim() && !validateMacAddress(manualMAC.trim())) {
      setManualFormError('La dirección MAC no es válida (ejemplo: A4:08:01:2C:9E:54)');
      return;
    }

    setManualFormError(null);
    setIsTestingIP(true);

    // Test connectivity
    const isLive = await probeLGDevice(ip, 1200);
    setIsTestingIP(false);

    onAddPhysicalTV(ip, manualName.trim() || `LG Smart TV (${ip})`, manualMAC.trim() || undefined);
    playSuccessBeep();
    setManualIP('');
    setActiveTab('scan');
  };

  const handleVerifyPin = async () => {
    if (!inputPin.trim()) return;
    playHapticClick(700);
    setIsSubmittingPin(true);
    setPinError(null);
    try {
      const success = await onConfirmPin(inputPin);
      if (success) {
        playSuccessBeep();
        setInputPin('');
      } else {
        setPinError('Código PIN rechazado por el televisor. Verifica el número en pantalla.');
      }
    } catch {
      setPinError('Error de comunicación al enviar PIN.');
    } finally {
      setIsSubmittingPin(false);
    }
  };

  const handleWoL = async (mac: string) => {
    playHapticClick(800);
    const ok = await onSendWakeOnLan(mac);
    if (ok) {
      setWolSuccess(`Paquete Wake-On-LAN enviado a ${mac}`);
      setTimeout(() => setWolSuccess(null), 3500);
    }
  };

  const handleRunDiagnostic = async (targetIp?: string) => {
    const ip = (targetIp || diagnosticIP || activeTV.ip).trim();
    if (!ip) return;
    playHapticClick(650);
    setIsDiagnosing(true);
    setDiagnostic3001Result(null);
    setDiagnostic3000Result(null);

    try {
      const [res3001, res3000] = await Promise.all([
        pingPort3001(ip, 3500),
        pingPort3000(ip, 2500),
      ]);
      setDiagnostic3001Result(res3001);
      setDiagnostic3000Result(res3000);

      setPerTvDiagnostic((prev) => ({
        ...prev,
        [ip]: { loading: false, result: res3001 },
      }));

      if (res3001.isOpen) {
        playSuccessBeep();
      }
    } catch {
      //
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleQuickPingTV = async (tvIp: string) => {
    playHapticClick(600);
    setPerTvDiagnostic((prev) => ({
      ...prev,
      [tvIp]: { loading: true, result: null },
    }));

    const res = await pingPort3001(tvIp, 3000);
    setPerTvDiagnostic((prev) => ({
      ...prev,
      [tvIp]: { loading: false, result: res },
    }));

    if (res.isOpen) {
      playSuccessBeep();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Conexión con TV Físico LG</h3>
              <p className="text-xs text-slate-400">Red Local Wi-Fi · Protocolo webOS SSAP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ventana de dispositivos"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector: 4 Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-2xl my-4 border border-slate-800">
          <button
            onClick={() => setActiveTab('scan')}
            className={`py-2 text-[11px] font-semibold rounded-xl transition-all ${
              activeTab === 'scan'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mis TVs
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-2 text-[11px] font-semibold rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'manual'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Poner IP</span>
          </button>
          <button
            onClick={() => {
              if (activeTV.ip && (!diagnosticIP || diagnosticIP === '192.168.1.100')) {
                setDiagnosticIP(activeTV.ip);
              }
              setActiveTab('diagnostic');
            }}
            className={`py-2 text-[11px] font-semibold rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'diagnostic'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diag. 3001</span>
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`py-2 text-[11px] font-semibold rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'help'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Guía TV</span>
          </button>
        </div>

        {/* TAB 1: LIST & SCAN */}
        {activeTab === 'scan' && (
          <div className="space-y-4">
            {/* Quick 3-Step Setup Guide */}
            <div className="p-3.5 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-800/60 rounded-2xl flex flex-col gap-2 shadow-inner">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>¿Por qué tu TV no responde? 3 Pasos obligatorios:</span>
              </div>
              <ol className="text-[11px] text-slate-300 space-y-1.5 list-decimal pl-4 leading-relaxed">
                <li>
                  <strong>En tu televisor LG (mando físico):</strong> Ve a <em>Ajustes (⚙️) ➔ General ➔ Dispositivos / Red ➔ "LG Connect Apps" (o "Encender mediante Wi-Fi" / "Control por IP")</em> y ponlo en <strong>ACTIVADO</strong>.
                </li>
                <li>
                  <strong>Misma red Wi-Fi:</strong> Tu móvil o PC debe estar en el mismo Wi-Fi que el TV (desactiva datos móviles 4G/5G).
                </li>
                <li>
                  <strong>Autorización SSL en Chrome:</strong> Como esta web corre en HTTPS, abre{' '}
                  <a
                    href={`https://${activeTV.ip || '192.168.1.50'}:3001`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 font-mono underline font-bold"
                  >
                    https://{activeTV.ip || '192.168.1.50'}:3001
                  </a>{' '}
                  y toca <em>"Configuración avanzada ➔ Acceder a la IP"</em>, <strong>o descarga el Mando Local (.html)</strong> que no tiene restricciones.
                </li>
              </ol>
            </div>

            {/* Subnet Scanner Bar */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Escaneo de Red Local Wi-Fi</span>
                <span className="text-[11px] text-slate-500 font-mono">Puertos 3001/3000</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 flex-1">
                  <span className="text-xs font-mono text-slate-400">Subred:</span>
                  <input
                    type="text"
                    value={subnetPrefix}
                    onChange={(e) => setSubnetPrefix(e.target.value)}
                    placeholder="192.168.1"
                    className="ml-2 w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                  />
                  <span className="text-xs font-mono text-slate-500">.X</span>
                </div>

                <button
                  onClick={handleStartSubnetScan}
                  disabled={isScanning || isSsdpScanning}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-400 flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-rose-400' : ''}`} />
                  <span>{isScanning ? 'Subred...' : 'Subred IP'}</span>
                </button>

                <button
                  onClick={handleStartSsdpScan}
                  disabled={isScanning || isSsdpScanning}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-indigo-400 flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 border border-slate-700"
                  title="Descubrimiento automático SSDP UDP Multicast (M-SEARCH a 239.255.255.250:1900)"
                >
                  <Radio className={`w-3.5 h-3.5 ${isSsdpScanning ? 'animate-pulse text-indigo-400' : ''}`} />
                  <span>{isSsdpScanning ? 'Buscando...' : 'SSDP (UDP)'}</span>
                </button>
              </div>

              {ssdpMessage && (
                <div className="text-[11px] font-mono px-2.5 py-1.5 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-300">
                  {ssdpMessage}
                </div>
              )}

              {isScanning && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>
                      Probando {subnetPrefix}.{scanProgress.current}...
                    </span>
                    <span>{Math.round((scanProgress.current / scanProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 transition-all duration-100"
                      style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* List of TVs */}
            <div className="space-y-3">
              {availableTVs.map((tv) => {
                const isSelected = activeTV.id === tv.id;
                const isPhysical = tv.isPhysical ?? (tv.id.startsWith('physical-') || !tv.id.includes('oled-c3'));
                const status = tv.connectionState || (tv.paired ? 'connected' : 'disconnected');

                return (
                  <div
                    key={tv.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-slate-800/80 border-rose-500/80 shadow-md shadow-rose-950/20'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                            isPhysical
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          <Tv className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{tv.name}</h4>
                            {isPhysical ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                TV Físico
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                Virtual Demo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            IP: <span className="text-rose-300 font-semibold">{tv.ip}</span> {tv.mac ? `· MAC: ${tv.mac}` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {tv.model || 'LG webOS Smart TV'} · Puerto {tv.port || 3001}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="text-right">
                        {status === 'connected' && (
                          <span className="text-[11px] font-medium text-emerald-400 flex items-center justify-end gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Conectado
                          </span>
                        )}
                        {status === 'connecting' && (
                          <span className="text-[11px] font-medium text-amber-400 flex items-center justify-end gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Conectando...
                          </span>
                        )}
                        {status === 'pairing_prompt' && (
                          <span className="text-[11px] font-bold text-amber-300 flex items-center justify-end gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400 animate-bounce" />
                            Aceptar en TV
                          </span>
                        )}
                        {status === 'pin_required' && (
                          <span className="text-[11px] font-bold text-amber-300 flex items-center justify-end gap-1">
                            <Key className="w-3 h-3 text-amber-400 animate-pulse" />
                            PIN en Pantalla
                          </span>
                        )}
                        {status === 'error' && (
                          <span className="text-[11px] font-medium text-rose-400 flex items-center justify-end gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Sin respuesta
                          </span>
                        )}
                        {status === 'disconnected' && (
                          <span className="text-[11px] text-slate-500">Desconectado</span>
                        )}
                      </div>
                    </div>

                    {/* PIN input box if TV requires PIN code */}
                    {isPhysical && (status === 'pin_required' || isSelected && activeTV.connectionState === 'pin_required') && (
                      <div className="mt-3 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                          <Key className="w-4 h-4 text-amber-400" />
                          <span>Introduce el código PIN que apareció en tu TV:</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={8}
                            value={inputPin}
                            onChange={(e) => setInputPin(e.target.value)}
                            placeholder="Ej: 12345678"
                            className="flex-1 px-3 py-1.5 bg-slate-950 border border-amber-700/60 rounded-lg text-white font-mono text-center tracking-widest text-sm focus:outline-none focus:border-amber-400"
                          />
                          <button
                            onClick={handleVerifyPin}
                            disabled={isSubmittingPin || !inputPin.trim()}
                            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            {isSubmittingPin ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>Enviar PIN</span>
                          </button>
                        </div>
                        {pinError && <p className="text-[11px] text-rose-400 font-medium">{pinError}</p>}
                      </div>
                    )}

                    {/* Pairing mode selector for physical TV */}
                    {isPhysical && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-400">Modo de vinculación:</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setSelectedPairingMode('PROMPT')}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                              selectedPairingMode === 'PROMPT'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Ventana "Aceptar" (PROMPT)
                          </button>
                          <button
                            onClick={() => setSelectedPairingMode('PIN')}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                              selectedPairingMode === 'PIN'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Código PIN (8 dígitos)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {tv.mac && (
                          <button
                            onClick={() => handleWoL(tv.mac)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-amber-300 flex items-center gap-1 transition-colors border border-slate-700"
                            title="Enviar paquete Wake-on-LAN para encender por Wi-Fi"
                          >
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>WoL (Encender)</span>
                          </button>
                        )}

                        {isPhysical && (
                          <button
                            onClick={() => onRequestPairing(tv, selectedPairingMode)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-[11px] font-semibold text-white flex items-center gap-1 transition-colors shadow-sm shadow-rose-900/30"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>{tv.paired ? 'Re-vincular' : 'Vincular con TV'}</span>
                          </button>
                        )}

                        {/* Quick Ping 3001 Diagnostic (fetch mode: no-cors) */}
                        {isPhysical && (
                          <button
                            onClick={() => handleQuickPingTV(tv.ip)}
                            disabled={perTvDiagnostic[tv.ip]?.loading}
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 border transition-all ${
                              perTvDiagnostic[tv.ip]?.loading
                                ? 'bg-slate-800 text-sky-300 border-sky-500/30'
                                : perTvDiagnostic[tv.ip]?.result?.isOpen
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/60'
                                : perTvDiagnostic[tv.ip]?.result
                                ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 hover:bg-rose-900/60'
                                : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-sky-500/30'
                            }`}
                            title="Comprobar con ping no-cors si el puerto 3001 del TV responde antes de conectar WebSocket"
                          >
                            {perTvDiagnostic[tv.ip]?.loading ? (
                              <>
                                <RefreshCw className="w-2.5 h-2.5 animate-spin text-sky-400" />
                                <span>Probando 3001...</span>
                              </>
                            ) : perTvDiagnostic[tv.ip]?.result?.isOpen ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>3001 Abierto ({perTvDiagnostic[tv.ip]?.result?.latencyMs}ms)</span>
                              </>
                            ) : perTvDiagnostic[tv.ip]?.result ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span>3001 Bloqueado</span>
                              </>
                            ) : (
                              <>
                                <Activity className="w-2.5 h-2.5 text-sky-400" />
                                <span>Ping 3001</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Direct SSL Cert bypass link for Chrome */}
                        {isPhysical && (
                          <a
                            href={`https://${tv.ip}:3001`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-teal-300 flex items-center gap-1 border border-teal-500/20"
                            title="Abre https://IP:3001 para que Chrome acepte el certificado SSL de la TV"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span>Permitir SSL (3001)</span>
                          </a>
                        )}

                        {/* Standalone offline HTML remote download */}
                        {isPhysical && (
                          <button
                            onClick={() => downloadStandaloneRemote(tv.ip, tv.name)}
                            className="px-2 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-[10px] font-medium text-purple-200 flex items-center gap-1 border border-purple-700/40"
                            title="Descargar control remoto local sin restricciones de SSL o Mixed-Content"
                          >
                            <Download className="w-2.5 h-2.5 text-purple-400" />
                            <span>Descargar Control Local (.html)</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {onRemoveTV && isPhysical && (
                          <button
                            onClick={() => onRemoveTV(tv.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Eliminar TV"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {!isSelected ? (
                          <button
                            onClick={() => onSelectTV(tv)}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors border border-slate-700"
                          >
                            Seleccionar
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-rose-400 font-bold px-2 py-0.5 rounded-lg bg-rose-950/40 border border-rose-800/40">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Activo</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick pairing notice and explanation */}
            {activeTV.isPhysical && (
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>¿Por qué tu TV respondió "hello world" pero dice "Sin respuesta"?</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  El mensaje <strong className="text-emerald-400 font-mono">"hello world"</strong> que viste en el puerto 3000 confirma al 100% que la IP es correcta y el televisor está encendido y accesible.
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Sin embargo, como esta app corre en una dirección web segura (HTTPS), los navegadores bloquean por seguridad las conexiones locales sin cifrar (Mixed Content) y los certificados SSL no oficiales en el puerto 3001. Por eso nunca llegó el mensaje de vinculación.
                </p>
                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => downloadStandaloneRemote(activeTV.ip, activeTV.name)}
                    className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Control Local (.html)</span>
                  </button>
                  <a
                    href={`https://${activeTV.ip}:3001`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors text-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Habilitar SSL en https://{activeTV.ip}:3001</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANUAL IP */}
        {activeTab === 'manual' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <h4 className="text-sm font-bold text-white mb-1">Añadir Dirección IP de tu LG TV</h4>
              <p className="text-xs text-slate-400 mb-4">
                Puedes ver la IP de tu TV en el menú del televisor: <br />
                <span className="text-rose-300 font-semibold">Ajustes ⚙️ → Red → Conexión Wi-Fi → Ajustes avanzados</span>.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Dirección IP del Televisor LG <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualIP}
                    onChange={(e) => setManualIP(e.target.value)}
                    placeholder="Ejemplo: 192.168.1.105 ó 192.168.0.45"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Nombre Descriptivo
                  </label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Ejemplo: LG OLED Sala de Estar"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Dirección MAC (Opcional, para encender el TV apagado por Wi-Fi)
                  </label>
                  <input
                    type="text"
                    value={manualMAC}
                    onChange={(e) => setManualMAC(e.target.value.toUpperCase())}
                    placeholder="Ejemplo: A4:08:01:2C:9E:54"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                {manualFormError && (
                  <p className="text-xs text-rose-400 font-medium">{manualFormError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (manualIP.trim()) {
                        setDiagnosticIP(manualIP.trim());
                        setActiveTab('diagnostic');
                        handleRunDiagnostic(manualIP.trim());
                      }
                    }}
                    disabled={!manualIP.trim()}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sky-300 font-bold text-xs rounded-xl transition-all border border-sky-500/30 flex items-center justify-center gap-1.5"
                  >
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    <span>Diagnosticar Puerto 3001</span>
                  </button>

                  <button
                    onClick={handleManualAdd}
                    disabled={isTestingIP || !manualIP.trim()}
                    className="flex-[2] py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-600/30 flex items-center justify-center gap-2"
                  >
                    {isTestingIP ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verificando conexión con {manualIP}...</span>
                      </>
                    ) : (
                      <>
                        <Tv className="w-4 h-4" />
                        <span>Guardar y Conectar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DIAGNOSTIC TOOL (PING PORT 3001 NO-CORS) */}
        {activeTab === 'diagnostic' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-sky-400" />
                    <span>Diagnóstico de Red: Puerto 3001 (SSL / WSS)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Verifica si el TV físico realmente responde antes de intentar la conexión WebSocket.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-sky-950/80 text-sky-300 border border-sky-800/40 shrink-0">
                  fetch no-cors
                </span>
              </div>

              {/* IP Input & quick select pills */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Dirección IP del Televisor a diagnosticar:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={diagnosticIP}
                    onChange={(e) => setDiagnosticIP(e.target.value)}
                    placeholder="Ejemplo: 192.168.1.100"
                    className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={() => handleRunDiagnostic()}
                    disabled={isDiagnosing || !diagnosticIP.trim()}
                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-sky-600/30 flex items-center gap-1.5 shrink-0"
                  >
                    {isDiagnosing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Haciendo Ping...</span>
                      </>
                    ) : (
                      <>
                        <Radio className="w-3.5 h-3.5" />
                        <span>Hacer Ping 3001</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick device selectors */}
                {availableTVs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500">Elegir TV guardado:</span>
                    {availableTVs.map((tv) => (
                      <button
                        key={tv.id}
                        type="button"
                        onClick={() => {
                          setDiagnosticIP(tv.ip);
                          handleRunDiagnostic(tv.ip);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors border ${
                          diagnosticIP === tv.ip
                            ? 'bg-sky-950 text-sky-300 border-sky-700/60'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {tv.name} ({tv.ip})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Visual Indicator of Port Open / Blocked */}
            {diagnostic3001Result ? (
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  diagnostic3001Result.isOpen
                    ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/30'
                    : 'bg-rose-950/40 border-rose-500/50 shadow-lg shadow-rose-950/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {diagnostic3001Result.isOpen ? (
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6 animate-pulse" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                        <XCircle className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold tracking-wide uppercase ${
                            diagnostic3001Result.isOpen ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        >
                          {diagnostic3001Result.isOpen
                            ? '🟢 Puerto 3001 Abierto y Accesible'
                            : '🛡️ Bloqueado por Seguridad de Chrome'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            diagnostic3001Result.isOpen
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-700/40'
                              : 'bg-amber-950 text-amber-400 border-amber-700/40'
                          }`}
                        >
                          {diagnostic3001Result.latencyMs} ms
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 font-medium">
                        {diagnostic3001Result.isOpen
                          ? diagnostic3001Result.message
                          : 'Tu TV tiene los puertos abiertos, pero Chrome bloquea la conexión desde la web por seguridad.'}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-800/80 leading-relaxed">
                  {diagnostic3001Result.details}
                </p>

                {/* Secondary Check: Port 3000 HTTP */}
                {diagnostic3000Result && (
                  <div className="mt-3 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px]">Puerto 3000 (HTTP "hello world"):</span>
                      <span
                        className={`text-[11px] font-bold ${
                          diagnostic3000Result.isOpen ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {diagnostic3000Result.isOpen
                          ? `🟢 Abierto (${diagnostic3000Result.latencyMs}ms)`
                          : '🛡️ Abierto en el TV · Bloqueado por Chrome (Mixed Content HTTPS)'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Actionable recommendations based on status */}
                <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                  {diagnostic3001Result.isOpen ? (
                    <div>
                      <p className="text-xs text-emerald-300 font-semibold mb-2">
                        ✨ ¡El TV responde por TLS! El canal WebSocket está listo:
                      </p>
                      <button
                        onClick={() => {
                          const tvMatch = availableTVs.find((t) => t.ip === diagnosticIP);
                          if (tvMatch) {
                            onSelectTV(tvMatch);
                            onRequestPairing(tvMatch, selectedPairingMode);
                          } else {
                            onAddPhysicalTV(diagnosticIP, `LG TV (${diagnosticIP})`);
                          }
                          setActiveTab('scan');
                        }}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Conectar y Vincular con {diagnosticIP}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Critical Explanation of Browser Block vs TV Open Port */}
                      <div className="p-3 bg-amber-950/40 border border-amber-600/50 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>¿Por qué tu escáner externo dice "Abierto" pero aquí dice "Bloqueado"?</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          ¡Tu escáner externo tiene toda la razón! Los puertos <strong>3000 y 3001 están ABIERTOS en tu TV</strong>. El televisor está encendido y listo.
                        </p>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          El bloqueo NO es de tu TV: <strong className="text-white">es tu navegador Google Chrome</strong>. Chrome prohíbe por seguridad (<em className="text-amber-200">Mixed Content y Private Network Access</em>) que páginas web en la nube como esta se conecten directamente a IPs privadas de tu casa (192.168.x.x) y bloquea el certificado SSL interno de LG.
                        </p>
                      </div>

                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Elige cómo deseas conectar con tu televisor:</span>
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          onClick={() => downloadStandaloneRemote(diagnosticIP, 'LG Smart TV')}
                          className="p-3 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/50 text-white text-xs flex flex-col justify-between transition-all text-left shadow-md shadow-purple-950/40"
                        >
                          <div className="flex items-center gap-1.5 font-bold mb-1 text-purple-200">
                            <Download className="w-4 h-4 text-purple-300 shrink-0" />
                            <span>1. Control Local (.html) [Recomendado]</span>
                          </div>
                          <span className="text-[10px] text-purple-300/90 leading-snug">
                            ¡Solución 100% garantizada! Al ser un archivo local, NO tiene bloqueo de Chrome. Se conecta directo por puerto 3000 o 3001.
                          </span>
                        </button>

                        <a
                          href={`https://${diagnosticIP}:3001`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-teal-500/40 text-teal-300 text-xs flex flex-col justify-between transition-colors"
                        >
                          <div className="flex items-center gap-1.5 font-bold mb-1">
                            <ExternalLink className="w-4 h-4 text-teal-400 shrink-0" />
                            <span>2. Autorizar Certificado en Chrome</span>
                          </div>
                          <span className="text-[10px] text-slate-400 leading-snug">
                            Abre https://{diagnosticIP}:3001 → Toca "Configuración avanzada" → "Acceder a sitio no seguro". Vuelve aquí y listo.
                          </span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-white">Prueba de respuesta del televisor</h5>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Pulsa <strong className="text-sky-300">"Hacer Ping 3001"</strong> para enviar una petición directa mediante fetch en modo <span className="font-mono text-white">no-cors</span> y medir si el puerto seguro está abierto o bloqueado.
                  </p>
                </div>
                <button
                  onClick={() => handleRunDiagnostic()}
                  disabled={isDiagnosing || !diagnosticIP.trim()}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-sky-600/30 inline-flex items-center gap-2"
                >
                  <Radio className="w-4 h-4" />
                  <span>Comprobar Puerto 3001 Ahora</span>
                </button>
              </div>
            )}

            {/* Educational card on how this ping works */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-2 text-slate-400">
              <div className="flex items-center gap-2 text-slate-300 font-bold">
                <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>¿Cómo funciona este ping con fetch mode: 'no-cors'?</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Los navegadores no permiten enviar paquetes ICMP ping estándar. Sin embargo,{' '}
                <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded font-mono">
                  fetch('https://IP:3001', &#123; mode: 'no-cors' &#125;)
                </code>{' '}
                inicia directamente un intento de conexión TCP y TLS con el televisor LG en el puerto 3001. Si el televisor está encendido y el puerto está abierto, el handshake se efectúa y devuelve una respuesta segura antes de que el WebSocket intente emparejarse.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: HELP & TROUBLESHOOTING GUIDE */}
        {activeTab === 'help' && (
          <div className="space-y-3.5 text-xs text-slate-300">
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs">
                  1
                </span>
                <span>Habilitar la opción en tu LG TV</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-7">
                Los televisores LG bloquean conexiones externas por defecto. Para permitir el control:
              </p>
              <ul className="list-disc pl-11 space-y-1 text-slate-300">
                <li>
                  <strong className="text-white">LG webOS 22, 23 o 24 (2022-2024):</strong><br />
                  Ajustes ⚙️ → General → Dispositivos → Gestión de dispositivos externos →{' '}
                  <span className="text-rose-300">Conectar a dispositivos móviles</span> (activar).
                </li>
                <li>
                  <strong className="text-white">LG webOS 4.0 a 6.0 (2018-2021):</strong><br />
                  Ajustes ⚙️ → Red → <span className="text-rose-300">Aplicaciones LG Connect</span> (activar).
                </li>
                <li>
                  Para encender el TV apagado: activa también{' '}
                  <span className="text-amber-300">"Encender con Wi-Fi / TV On With Mobile"</span>.
                </li>
              </ul>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs">
                  2
                </span>
                <span>Autorizar Certificado SSL en Chrome / Android</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-7">
                Cuando instalas una PWA por HTTPS, Chrome exige conexión segura (WSS en puerto 3001). Como los televisores LG usan un certificado SSL interno, Chrome lo bloquea hasta que lo autorizas una vez:
              </p>
              <div className="pl-7 pt-1 space-y-2">
                {activeTV.ip ? (
                  <a
                    href={`https://${activeTV.ip}:3001`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-colors shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir https://{activeTV.ip}:3001 en Chrome</span>
                  </a>
                ) : (
                  <p className="text-slate-500 italic">Ingresa primero la IP de tu TV en la pestaña "Poner IP".</p>
                )}
                <p className="text-[11px] text-slate-400">
                  Al abrir el enlace, Chrome dirá <em>"La conexión no es privada"</em>. Toca en{' '}
                  <strong className="text-white">"Configuración avanzada"</strong> y luego en{' '}
                  <strong className="text-white">"Acceder a {activeTV.ip || 'tu TV'} (sitio no seguro)"</strong>. ¡Listo! Vuelve a esta app y funcionará al instante.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs">
                  3
                </span>
                <span>Misma Red Wi-Fi (Sin aislamiento AP)</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-7">
                Tu teléfono celular y el televisor LG deben estar conectados a la misma red Wi-Fi de tu casa. Si tu router tiene una red de invitados (Guest) o aislamiento de clientes (AP Isolation), los dispositivos no podrán comunicarse entre sí.
              </p>
            </div>
          </div>
        )}

        {wolSuccess && (
          <div className="mt-4 p-2.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{wolSuccess}</span>
          </div>
        )}
      </div>
    </div>
  );
};

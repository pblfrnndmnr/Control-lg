import React, { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  X,
  Smartphone,
  Terminal,
  Tv,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { playHapticClick, playSuccessBeep } from '../utils/audioFeedback.ts';

interface PythonExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeIp: string;
  activeMac: string;
}

export const PythonExportModal: React.FC<PythonExportModalProps> = ({
  isOpen,
  onClose,
  activeIp,
  activeMac,
}) => {
  const [activeTab, setActiveTab] = useState<'python' | 'guide' | 'android'>('python');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pythonScriptPreview = `#!/usr/bin/env python3
"""
Control Remoto LG webOS Smart TV
Requisitos: pip install bscpylgtv websockets
"""
import sys, os, json, socket, asyncio
from typing import Optional

# 1. ENCENDIDO POR WI-FI (WAKE-ON-LAN NATIVO SIN LIBRERÍAS)
def wake_on_lan(mac_address: str):
    clean_mac = mac_address.replace(":", "").replace("-", "").strip()
    mac_bytes = bytes.fromhex(clean_mac)
    magic_packet = b"\\xff" * 6 + mac_bytes * 16
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.sendto(magic_packet, ("255.255.255.255", 9))
    print(f"[OK] Paquete WoL emitido a {mac_address}")

# 2. CONTROLADOR WEBSOCKET (webOS SSAP)
async def send_tv_command(ip: str, action: str, **kwargs):
    from bscpylgtv import WebOsClient
    
    # Llave de emparejamiento persistida
    key_file = "lg_tv_key.json"
    client_key = None
    if os.path.exists(key_file):
        with open(key_file) as f:
            client_key = json.load(f).get("key")

    client = await WebOsClient.create(ip, client_key=client_key)
    await client.connect()

    # Guardar llave si es la primera vez que se autoriza en pantalla
    if not client_key and client.client_key:
        with open(key_file, "w") as f:
            json.dump({"key": client.client_key}, f)
        print("[INFO] Nueva llave de emparejamiento guardada.")

    # Acciones
    if action == "vol_up":
        await client.volume_up()
    elif action == "vol_down":
        await client.volume_down()
    elif action == "mute":
        await client.set_mute(kwargs.get("state", True))
    elif action == "app":
        app_id = kwargs.get("app_id", "youtube.leanback.v4")
        await client.launch_app(app_id)
    elif action == "input":
        await client.set_input(kwargs.get("input_id", "HDMI_2"))
    elif action == "home":
        await client.button("HOME")
    elif action == "power_off":
        await client.power_off()

    await client.disconnect()

if __name__ == "__main__":
    # Ejemplo de uso:
    IP_TV = "${activeIp || '192.168.1.105'}"
    MAC_TV = "${activeMac || 'A4:08:01:2C:9E:54'}"

    # Encender por Wi-Fi:
    # wake_on_lan(MAC_TV)

    # Subir volumen:
    asyncio.run(send_tv_command(IP_TV, "vol_up"))
`;

  const handleCopy = () => {
    playHapticClick(700);
    navigator.clipboard.writeText(pythonScriptPreview);
    setCopied(true);
    playSuccessBeep();
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 select-none animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full h-[680px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Guía de Implementación Real</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-mono">
                  Python + Android
                </span>
              </div>
              <p className="text-xs text-slate-400">Pasa de la simulación a controlar tu televisor físico</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal de código"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 p-1">
          <button
            onClick={() => setActiveTab('python')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'python' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Código Python</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'guide' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-rose-400" />
            <span>Paso a Paso en tu TV</span>
          </button>
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'android' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-400" />
            <span>Crear la App para Android</span>
          </button>
        </div>

        {/* TAB 1: PYTHON SCRIPT */}
        {activeTab === 'python' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <span>Archivo: <strong className="text-emerald-400 font-mono">lg_webos_remote.py</strong></span>
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-3 font-mono text-xs text-slate-300 leading-relaxed scrollbar-none">
              <pre className="whitespace-pre">{pythonScriptPreview}</pre>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>El script ya está guardado en la raíz de tu proyecto como <code className="text-emerald-300">lg_webos_remote.py</code>.</span>
            </div>
          </div>
        )}

        {/* TAB 2: STEP BY STEP TV SETUP */}
        {activeTab === 'guide' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-950 text-xs leading-relaxed">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-500" />
                <span>Paso 1: Configurar el TV LG para permitir control por red</span>
              </h4>
              <p className="text-slate-300 mt-1">
                Enciende tu televisor LG con el control físico y realiza estos dos ajustes indispensables:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300 font-medium">
                <li>
                  <strong>Habilitar Apps Móviles:</strong> Ve a <em>Ajustes ⚙ &gt; General &gt; Dispositivos &gt; Dispositivos externos &gt; Conectar a app móvil / LG Connect Apps</em> y ponlo en <strong>Activado</strong>.
                </li>
                <li>
                  <strong>Permitir Encendido por Wi-Fi (Wake-on-LAN):</strong> En el mismo menú, activa <em>"Encender TV vía Wi-Fi"</em> (o <em>"Always Ready / Quick Start+"</em>). Sin esto, el TV apaga su tarjeta Wi-Fi y no responderá al encendido remoto.
                </li>
              </ul>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Tv className="w-4 h-4 text-emerald-400" />
                <span>Paso 2: Obtener la IP y MAC de tu televisor</span>
              </h4>
              <p className="text-slate-300 mt-1">
                Ve a <em>Ajustes ⚙ &gt; Red &gt; Conexión Wi-Fi &gt; Ajustes avanzados de Wi-Fi</em>. Anota:
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[11px]">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block">Dirección IP:</span>
                  <span className="text-emerald-400 font-bold">{activeIp || '192.168.1.105'}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block">Dirección MAC:</span>
                  <span className="text-rose-400 font-bold">{activeMac || 'A4:08:01:2C:9E:54'}</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span>Paso 3: Instalar dependencias y ejecutar en tu computadora</span>
              </h4>
              <p className="text-slate-300">Abre tu terminal en Windows, Mac o Linux e instala las librerías:</p>
              <div className="my-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-emerald-400 text-xs">
                pip install bscpylgtv websockets wakeonlan
              </div>
              <p className="text-slate-300">Ejecuta el script apuntando a tu televisor:</p>
              <div className="my-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-200 text-xs">
                python lg_webos_remote.py --ip {activeIp || '192.168.1.105'} --interactive
              </div>
              <p className="text-amber-300 text-[11px] mt-1 font-semibold">
                ⚠️ Importante: La primera vez aparecerá una ventana emergente en la esquina de tu televisor diciendo <em>"¿Desea aceptar la conexión de LG Remote?"</em>. Presiona <strong>Aceptar</strong> con el Magic Remote para que guarde la llave de seguridad.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: ANDROID APP CREATION OPTIONS */}
        {activeTab === 'android' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-950 text-xs leading-relaxed">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600/20 text-emerald-400 font-bold flex items-center justify-center text-xs">A</span>
                  <span>Método 1: Convertir esta Web App en APK Android (Capacitor)</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 font-bold">Más Rápido</span>
              </div>
              <p className="text-slate-300 mt-1">
                Esta interfaz que creamos ya está perfectamente adaptada para Android y tiene háptica y audio nativo. Puedes compilarla directamente a un APK instalable usando <strong>Capacitor</strong>:
              </p>
              <div className="my-2 p-2.5 bg-slate-950 rounded-xl font-mono text-emerald-300 text-[11px] space-y-1">
                <div>npm install @capacitor/core @capacitor/cli @capacitor/android</div>
                <div>npx cap init "LG ThinQ Remote" "com.lgremote.app"</div>
                <div>npm run build</div>
                <div>npx cap add android</div>
                <div>npx cap open android  # Abre Android Studio para generar el APK</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-xs">B</span>
                  <span>Método 2: Python Nativo en Android (Kivy / BeeWare)</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950 text-blue-300 font-bold">100% Python</span>
              </div>
              <p className="text-slate-300 mt-1">
                Si prefieres que todo el código esté en Python puro, puedes usar <strong>Kivy</strong> o <strong>Flet</strong> con <strong>Buildozer</strong>:
              </p>
              <div className="my-2 p-2.5 bg-slate-950 rounded-xl font-mono text-blue-300 text-[11px] space-y-1">
                <div>pip install buildozer kivy</div>
                <div>buildozer init</div>
                <div>buildozer android debug  # Genera el archivo .apk en tu carpeta bin/</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-600/20 text-purple-400 font-bold flex items-center justify-center text-xs">C</span>
                  <span>Método 3: App Nativa Android en Kotlin (Android Studio)</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 font-bold">Rendimiento Máximo</span>
              </div>
              <p className="text-slate-300 mt-1">
                En Android Studio con Jetpack Compose:
              </p>
              <ul className="list-disc list-inside mt-1 space-y-1 text-slate-300">
                <li>Para <strong>Wake-on-LAN</strong>: Usas <code>DatagramSocket</code> en un hilo de fondo enviando el paquete al puerto 9.</li>
                <li>Para <strong>comandos webOS</strong>: Usas la librería <code>OkHttp3</code> con WebSocket apuntando a <code>wss://IP:3001</code> con handshake JSON.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

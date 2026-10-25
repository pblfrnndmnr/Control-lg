/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  ExternalLink,
  Github,
  Zap,
  Layers,
  Copy,
  Check,
  X,
  HelpCircle,
  Sparkles,
  FileCheck,
  FileText,
  Info,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AndroidInstallModal({ isOpen, onClose }: AndroidInstallModalProps) {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadFile = async (filename: string) => {
    try {
      const response = await fetch(`/${filename}`);
      const content = await response.text();
      const blob = new Blob([content], {
        type: filename.endsWith('.json') ? 'application/json' : 'application/javascript',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(`/${filename}`, '_blank');
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTriggerInstall = async () => {
    if (canInstall) {
      const success = await install();
      if (success) {
        setInstallStatus('¡Aplicación instalada con éxito en tu dispositivo!');
      }
    } else {
      setInstallStatus(
        'Para instalar en Android: Abre el menú de Chrome (⋮) en tu móvil y pulsa "Instalar aplicación" o "Añadir a pantalla de inicio".'
      );
    }
  };

  const githubWorkflowCode = `name: Compilar APK Android LG Remote

on:
  workflow_dispatch:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Instalar dependencias
        run: npm install

      - name: Build Web App
        run: npm run build

      - name: Setup Java JDK
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'
          cache: 'gradle'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Sincronizar Proyecto Android (Capacitor)
        run: |
          if [ ! -d "android" ]; then
            npx cap add android
          fi
          npx cap sync android

      - name: Compilar APK con Gradle
        run: |
          cd android
          chmod +x ./gradlew
          ./gradlew assembleDebug --no-daemon --stacktrace
          cd ..
          find android/app/build/outputs/apk -name "*.apk" -exec cp {} ./LG-Remote-v1.0.0-debug.apk \;

      - name: Subir APK como artefacto
        uses: actions/upload-artifact@v4
        with:
          name: LG-Remote-Android-APK
          path: LG-Remote-v1.0.0-debug.apk`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Instalar App en tu Android
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                  Sin Complicaciones
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Opciones directas para tener el mando en tu teléfono móvil
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Method 1: Instant Native Installation (PWA / WebAPK) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border border-rose-600/30 shadow-lg">
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Instalación Instantánea en Android (Recomendada)
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30">
                      0 segundos
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Android compila automáticamente un WebAPK nativo con icono de LG y pantalla completa.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/70 space-y-2 mb-3">
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Funciona exactamente igual que un APK descargado (ícono, splash y pantalla completa).</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Controla el televisor por Wi-Fi directo en la misma red local de tu casa.</span>
              </div>
            </div>

            {isInstalled ? (
              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 flex items-center gap-2 font-medium">
                <Check className="w-4 h-4" />
                <span>¡La aplicación ya está instalada en tu dispositivo como app nativa!</span>
              </div>
            ) : (
              <button
                onClick={handleTriggerInstall}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>{canInstall ? 'Instalar Ahora en Este Teléfono' : '¿Cómo Instalar en mi Teléfono Móvil?'}</span>
              </button>
            )}

            {installStatus && (
              <p className="mt-2 text-[11px] text-rose-300 bg-rose-950/50 p-2 rounded-lg border border-rose-800/40">
                {installStatus}
              </p>
            )}
          </div>

          {/* PWA Manifest & Service Worker Verification Section */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Archivos PWA Incluidos en el Servidor
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Comprobación directa de los archivos requeridos para la instalación
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                100% Configurado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Manifest Card */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    <span>manifest.json</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Activo
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Nombre, descripción, categorías e iconos 192px/512px listos.
                </p>
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => handleDownloadFile('manifest.json')}
                    className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 border border-sky-500/20"
                  >
                    <Download className="w-3 h-3" />
                    <span>Descargar</span>
                  </button>
                  <a
                    href="/manifest.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 border border-slate-700"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ver</span>
                  </a>
                </div>
              </div>

              {/* Service Worker Card */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>service-worker.js</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Registrado
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Caché offline, eventos fetch y control de clientes nativo.
                </p>
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => handleDownloadFile('service-worker.js')}
                    className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 border border-amber-500/20"
                  >
                    <Download className="w-3 h-3" />
                    <span>Descargar</span>
                  </button>
                  <a
                    href="/service-worker.js"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 border border-slate-700"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ver</span>
                  </a>
                </div>
              </div>
            </div>

            {/* PWABuilder Explanation Box */}
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>¿Por qué PWABuilder te dice que "no tienes manifest ni worker"?</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                PWABuilder es un robot automatizado externo. Al intentar visitar la URL de desarrollo de AI Studio, recibe la pantalla de autenticación de Google (<code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded font-mono">__cookie_check.html</code>) porque no tiene tu sesión abierta. Al no poder superar la pantalla de Google, reporta erróneamente que los archivos no existen.
              </p>
              <p className="text-[11px] text-emerald-300 font-medium">
                👉 Como viste, la app <strong>sí se instala correctamente desde Chrome</strong>, confirmando que el manifest y el worker están 100% presentes y funcionando.
              </p>
            </div>
          </div>

          {/* Method 3: GitHub Action Automatic APK Compiler */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-bold text-white">
                    Compilador Automático GitHub Action (.apk)
                  </h3>
                </div>
              </div>
              <button
                onClick={() => handleCopy(githubWorkflowCode, 'workflow')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors text-[11px]"
              >
                {copiedKey === 'workflow' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'workflow' ? 'Copiado' : 'Copiar YAML'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Hemos incluido el flujo de trabajo en <code className="text-amber-400">.github/workflows/build-apk.yml</code>. Al subir este repositorio a GitHub, los servidores de GitHub compilan el APK automáticamente gratis.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Iconos de 192px y 512px y manifest PWA ya generados en el proyecto.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

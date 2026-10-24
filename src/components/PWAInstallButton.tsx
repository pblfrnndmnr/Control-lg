/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Smartphone, Download, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  onOpenModal: () => void;
  className?: string;
  variant?: 'header' | 'remote' | 'compact';
}

export function PWAInstallButton({ onOpenModal, className = '', variant = 'header' }: PWAInstallButtonProps) {
  const { canInstall, isInstalled, install } = usePWAInstall();

  const handleClick = async () => {
    if (canInstall) {
      await install();
    } else {
      onOpenModal();
    }
  };

  if (isInstalled) {
    return (
      <button
        onClick={onOpenModal}
        className={`px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-900/50 transition-colors ${className}`}
        title="App instalada en el dispositivo"
      >
        <Check className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">App Instalada</span>
        <span className="sm:hidden">Instalada</span>
      </button>
    );
  }

  if (variant === 'remote') {
    return (
      <button
        onClick={handleClick}
        className={`w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30 transition-all active:scale-[0.98] ${className}`}
      >
        <Smartphone className="w-4 h-4" />
        <span>Instalar en tu Android</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all active:scale-[0.98] whitespace-nowrap ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      <span>Instalar APK / App</span>
    </button>
  );
}

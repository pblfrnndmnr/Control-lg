import React from 'react';
import { Wifi, BatteryMedium, Signal } from 'lucide-react';

interface AndroidPhoneFrameProps {
  children: React.ReactNode;
  isStandaloneMobile?: boolean;
}

export const AndroidPhoneFrame: React.FC<AndroidPhoneFrameProps> = ({
  children,
  isStandaloneMobile = false,
}) => {
  // If the user is on a true mobile viewport, we fill the screen naturally
  if (isStandaloneMobile) {
    return (
      <div className="w-full min-h-screen bg-slate-950 flex flex-col text-slate-100">
        {/* Android Native Status Bar */}
        <div className="h-7 px-5 flex items-center justify-between text-[11px] font-medium text-slate-400 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
          <span className="font-mono">12:44</span>
          <div className="flex items-center gap-1.5">
            <Signal className="w-3 h-3 text-slate-400" />
            <Wifi className="w-3 h-3 text-slate-300" />
            <span className="text-[10px] font-mono">98%</span>
            <BatteryMedium className="w-3.5 h-3.5 text-slate-300" />
          </div>
        </div>
        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    );
  }

  // Desktop showcase Android phone frame
  return (
    <div className="relative mx-auto w-[390px] h-[780px] bg-slate-900 rounded-[44px] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-[6px] border-slate-700/80 ring-1 ring-slate-800 flex flex-col shrink-0 select-none">
      {/* Front camera punch-hole notch */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-black border border-slate-800 z-50 shadow-inner" />

      {/* Screen area with rounded corners */}
      <div className="relative w-full h-full bg-slate-950 rounded-[34px] overflow-hidden flex flex-col border border-slate-800">
        {/* Android Status Bar */}
        <div className="h-7 px-6 pt-1 flex items-center justify-between text-[11px] font-medium text-slate-400 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
          <span className="font-mono">12:44</span>
          <div className="flex items-center gap-2">
            <Signal className="w-3 h-3 text-slate-400" />
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-mono">98%</span>
            <BatteryMedium className="w-3.5 h-3.5 text-slate-300" />
          </div>
        </div>

        {/* Inner Phone Content */}
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-none relative">
          {children}
        </div>

        {/* Android Navigation Gesture Bar */}
        <div className="h-5 bg-slate-950 flex items-center justify-center shrink-0">
          <div className="w-28 h-1 bg-slate-600 rounded-full" />
        </div>
      </div>
    </div>
  );
};

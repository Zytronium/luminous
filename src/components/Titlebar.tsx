"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Minus, Square, X } from "lucide-react";
import { usePathname } from "next/navigation";

// Extend Window type to include electronAPI
declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

export default function TitleBar() {
  const [isElectron, setIsElectron] = useState(false);
  const [platform, setPlatform] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    if (window.electronAPI?.isElectron) {
      setIsElectron(true);
      setPlatform(window.electronAPI.platform);
    }
  }, []);

  if (!isElectron || pathname === "/chat")
    return null;

  const isMac = platform === "darwin";

  return (
    <div
      className="flex items-center justify-between w-full h-9 bg-darker-blue border-b border-beige/10 select-none shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* App name + icon */}
      <div className="flex items-center gap-2 px-3">
        <Image src="/logo.png" alt="Luminous" width={16} height={16} className="rounded-full" />
        <span className="text-xs font-semibold text-offwhite/60 tracking-wide">Luminous</span>
      </div>

      {/* Window controls — right side on Windows/Linux, hidden on Mac (Mac has native controls) */}
      {!isMac && (
        <div
          className="flex items-center h-full"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={() => window.electronAPI?.minimize()}
            className="flex items-center justify-center w-11 h-full text-offwhite/60 hover:bg-beige/10 hover:text-offwhite transition-colors"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => window.electronAPI?.maximize()}
            className="flex items-center justify-center w-11 h-full text-offwhite/60 hover:bg-beige/10 hover:text-offwhite transition-colors"
            title="Maximize"
          >
            <Square size={12} />
          </button>
          <button
            onClick={() => window.electronAPI?.close()}
            className="flex items-center justify-center w-11 h-full text-offwhite/60 hover:bg-red hover:text-white transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
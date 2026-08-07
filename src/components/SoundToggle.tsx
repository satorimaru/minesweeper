"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/sfx";

interface SoundToggleProps {
  className?: string;
  compact?: boolean;
}

export function SoundToggle({ className = "", compact }: SoundToggleProps) {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(sfx.isMuted());
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        sfx.unlock();
        const next = sfx.toggleMute();
        setMuted(next);
        if (!next) sfx.ui();
      }}
      className={
        className ||
        (compact
          ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base active:bg-white/20"
          : "rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white/80 ring-1 ring-white/10 active:bg-white/15")
      }
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      title={muted ? "Sound off" : "Sound on"}
    >
      {muted ? "🔇" : "🔊"}
      {!compact && (
        <span className="ml-1.5">{muted ? "Sound off" : "Sound on"}</span>
      )}
    </button>
  );
}

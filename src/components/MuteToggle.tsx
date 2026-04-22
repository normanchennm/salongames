"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, setMuted } from "@/lib/narrator";

/** Tiny header widget to toggle the narrator on/off. State lives in
 *  localStorage so it survives reloads. Renders nothing on the first
 *  client render to avoid SSR/CSR mismatch on the icon. */

export function MuteToggle() {
  const [mounted, setMounted] = useState(false);
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMuted(isMuted());
    setMutedState(isMuted());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const toggle = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg"
      aria-pressed={muted}
      aria-label={muted ? "Unmute narrator" : "Mute narrator"}
    >
      {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      {muted ? "muted" : "narrator"}
    </button>
  );
}

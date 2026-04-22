"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { loadProState, unlockProBeta } from "@/lib/pro";

/** Pro unlock gate. Beta phase: no payment, just a confirmation +
 *  flag. Modal opens from anywhere (GameCard tap on a locked game,
 *  /unlock route, or direct button). */

export function ProGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(loadProState().unlocked);
  }, [open]);

  if (!open) return null;

  const confirm = () => {
    unlockProBeta();
    setUnlocked(true);
    if (typeof window !== "undefined") {
      // Reload so gated cards un-blur across the catalog.
      setTimeout(() => window.location.reload(), 300);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm">
      <div className="mx-auto max-w-md rounded-lg border border-[hsl(var(--ember)/0.5)] bg-bg p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[hsl(var(--ember))]" />
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Pro</p>
        </div>
        <h2 className="mt-2 font-display text-3xl italic">New packs. Exclusive rooms. Hot drops.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Pro unlocks every new content pack we ship — more Fibbage decks, new escape rooms, late-night prompt packs, narrator voice packs. Everything in one toggle, no accounts, no ads.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          We&apos;re in private beta — skip the payment, try Pro for free while we tune it. When we ship for real, your unlock stays.
        </p>
        {unlocked ? (
          <div className="mt-6 rounded-md border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-4 py-3 text-center">
            <p className="font-display text-xl italic text-[hsl(var(--ember))]">You&apos;re in. ✨</p>
            <p className="mt-1 text-xs text-muted">All Pro content is unlocked on this device.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={confirm}
              className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Beta — Unlock Pro
            </button>
          </div>
        )}
        {unlocked && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

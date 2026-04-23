"use client";

import { Users, Globe2 } from "lucide-react";

/** Mode picker shown on the game detail page when a game supports
 *  remote play. User chooses between classic pass-and-play on one
 *  device vs a WebRTC room where each player uses their own phone. */

export type PlayMode = "local" | "remote-host" | "remote-join";

export function ModePicker({ onPick }: { onPick: (mode: PlayMode) => void }) {
  return (
    <div className="animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">How do you want to play?</p>
      <h2 className="mt-2 font-display text-3xl italic">One table, or one phone each?</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onPick("local")}
          className="group relative overflow-hidden rounded-lg border border-border bg-bg/40 p-6 text-left transition-colors hover:border-[hsl(var(--ember)/0.6)]"
        >
          <Users className="h-5 w-5 text-[hsl(var(--ember))]" />
          <h3 className="mt-3 font-display text-2xl italic">Same table</h3>
          <p className="mt-2 text-sm leading-snug text-muted">
            One device, passed around. The classic pass-and-play experience — zero setup, everyone shares the phone.
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            no internet required
          </p>
        </button>
        <button
          type="button"
          onClick={() => onPick("remote-host")}
          className="group relative overflow-hidden rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.05)] p-6 text-left transition-colors hover:border-[hsl(var(--ember))]"
        >
          <Globe2 className="h-5 w-5 text-[hsl(var(--ember))]" />
          <h3 className="mt-3 font-display text-2xl italic">Remote room</h3>
          <p className="mt-2 text-sm leading-snug text-muted">
            Each player uses their own phone. You create a room code, share it, friends join from wherever they are.
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
            no accounts, no servers
          </p>
        </button>
      </div>
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => onPick("remote-join")}
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          have a code? join a room →
        </button>
      </div>
    </div>
  );
}

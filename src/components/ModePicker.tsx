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
      <h2 className="mt-2 font-display text-3xl italic">One phone, or one phone each?</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onPick("remote-host")}
          className="group relative overflow-hidden rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.05)] p-6 text-left transition-colors hover:border-[hsl(var(--ember))]"
        >
          <Globe2 className="h-5 w-5 text-[hsl(var(--ember))]" />
          <h3 className="mt-3 font-display text-2xl italic">Own phones</h3>
          <p className="mt-2 text-sm leading-snug text-muted">
            Every player uses their own phone — works the same way in the same room or across cities. Create a room code, share it, everyone joins and plays simultaneously. Private roles stay private; no passing.
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
            recommended · no accounts
          </p>
        </button>
        <button
          type="button"
          onClick={() => onPick("local")}
          className="group relative overflow-hidden rounded-lg border border-border bg-bg/40 p-6 text-left transition-colors hover:border-[hsl(var(--ember)/0.6)]"
        >
          <Users className="h-5 w-5 text-muted" />
          <h3 className="mt-3 font-display text-2xl italic">One phone, passed around</h3>
          <p className="mt-2 text-sm leading-snug text-muted">
            Only one device available? Pass it around the table for private moments. Works offline — but expect some awkward phone-handoffs for roles and hidden info.
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            no internet required
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

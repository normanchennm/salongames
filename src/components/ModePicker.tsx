"use client";

import { Users, Globe2 } from "lucide-react";

/** Mode picker shown on the game detail page when a game supports
 *  remote play. Multi-device is primary; single-phone is offered as a
 *  secondary option *only* for games where it's a reasonable fallback
 *  (games tagged `hideLocalOption: true` don't get the fallback link). */

export type PlayMode = "local" | "remote-host" | "remote-join";

export function ModePicker({ onPick, allowLocal = true }: { onPick: (mode: PlayMode) => void; allowLocal?: boolean }) {
  return (
    <div className="animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">Play with friends on their own phones</p>
      <h2 className="mt-2 font-display text-3xl italic">Host or join a room.</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onPick("remote-host")}
          className="group relative overflow-hidden rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.05)] p-6 text-left transition-colors hover:border-[hsl(var(--ember))]"
        >
          <Globe2 className="h-5 w-5 text-[hsl(var(--ember))]" />
          <h3 className="mt-3 font-display text-2xl italic">Host a room</h3>
          <p className="mt-2 text-sm leading-snug text-muted">
            Create a code, share it with the table. Each player joins on their own phone. Works in the same room or across cities.
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
            no accounts · no servers
          </p>
        </button>
        <button
          type="button"
          onClick={() => onPick("remote-join")}
          className="group relative overflow-hidden rounded-lg border border-border bg-bg/40 p-6 text-left transition-colors hover:border-[hsl(var(--ember)/0.6)]"
        >
          <Users className="h-5 w-5 text-muted" />
          <h3 className="mt-3 font-display text-2xl italic">Join with a code</h3>
          <p className="mt-2 text-sm leading-snug text-muted">
            Got a 5-letter code from whoever&apos;s hosting? Tap to join their room.
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            enter code next
          </p>
        </button>
      </div>
      {allowLocal && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => onPick("local")}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
          >
            only one phone available? play pass-and-play →
          </button>
        </div>
      )}
    </div>
  );
}

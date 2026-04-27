"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import type { PTalkRemoteState, PTalkRemoteAction } from "./remote";
import type { Tier } from "./prompts";

interface Props extends GameComponentProps { remote: RemoteContext; }

const TIER_LABELS: Record<Tier, string> = {
  close: "close",
  closer: "closer",
  closest: "closest",
};
const TIER_BLURB: Record<Tier, string> = {
  close: "warm-up · noticing",
  closer: "vulnerable · what you don't say",
  closest: "intimate · soft, slow, true",
};

/** Pillow Talk remote — same vibe as local, just shared. No host vs
 *  joiner roles; either device can draw, both see it. Same low-contrast
 *  shell. End-night is consensus-via-button: whoever taps it ends. */
export const PillowTalkRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as PTalkRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: PTalkRemoteAction) => void;
  const completedRef = useRef(false);
  useScrollToTop(state ? state.kind + ("count" in state ? `-${state.count}` : "") : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${state.count} prompts`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <BedtimeShell>
        <section role="status" aria-live="polite" className="mx-auto max-w-md pt-12 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember)/0.7)]" />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted/70">Setting up…</p>
        </section>
      </BedtimeShell>
    );
  }

  const code = remote.code;

  if (state.kind === "intro") {
    return (
      <BedtimeShell>
        <RoomBar code={code} />
        <section className="mx-auto max-w-md text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[hsl(var(--ember)/0.7)]">Pillow Talk</p>
          <h2 className="mt-3 font-display text-3xl italic leading-snug text-fg/80">
            Same room.<br/>Same dark.<br/>Pick a tier — either of you.
          </h2>
          <p className="mt-6 mx-auto max-w-sm text-sm leading-relaxed text-muted/80">
            Either device draws. The card appears on both phones.
          </p>
          <div className="mt-10 grid gap-2">
            {(["close", "closer", "closest"] as Tier[]).map((t) => (
              <TierButton key={t} tier={t} onClick={() => dispatch({ type: "draw", tier: t })} />
            ))}
          </div>
          <button
            type="button"
            onClick={onQuit}
            className="mt-8 w-full font-mono text-[10px] uppercase tracking-[0.3em] text-muted/60"
          >
            Leave room
          </button>
        </section>
      </BedtimeShell>
    );
  }

  if (state.kind === "end") {
    return (
      <BedtimeShell>
        <RoomBar code={code} />
        <section className="mx-auto max-w-md text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted/60">Goodnight</p>
          <h2 className="mt-2 font-display text-3xl italic text-fg/80">{state.count} prompts.</h2>
          <p className="mt-4 text-sm text-muted/70">Sleep close.</p>
          <button
            type="button"
            onClick={onQuit}
            className="mt-10 w-full rounded-md border border-border/60 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted/70"
          >
            Leave room
          </button>
        </section>
      </BedtimeShell>
    );
  }

  // open
  return (
    <BedtimeShell>
      <RoomBar code={code} />
      <section className="mx-auto max-w-md">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-muted/60">
          <span>{TIER_LABELS[state.tier]}</span>
          <span>{state.count} drawn</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.2)] bg-[hsl(var(--ember)/0.04)] px-6 py-12">
          <p className="font-display text-2xl italic leading-snug text-fg/85">{state.current}</p>
        </div>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted/50">
          {TIER_BLURB[state.tier]}
        </p>
        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-muted/70 text-center">
          Draw another
        </p>
        <div className="mt-3 grid gap-2">
          {(["close", "closer", "closest"] as Tier[]).map((t) => (
            <TierButton
              key={t}
              tier={t}
              onClick={() => dispatch({ type: "draw", tier: t })}
              dim={t !== state.tier}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "end-night" })}
          className="mt-8 w-full font-mono text-[10px] uppercase tracking-[0.3em] text-muted/60"
        >
          Set the deck down · {state.count} drawn
        </button>
      </section>
    </BedtimeShell>
  );
};

function TierButton({
  tier,
  onClick,
  dim = false,
}: {
  tier: Tier;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-baseline justify-between rounded-md border border-border/60 bg-bg/30 px-4 py-3 text-left transition-colors hover:border-[hsl(var(--ember)/0.4)] ${dim ? "opacity-60" : ""}`}
    >
      <span className="font-display text-lg italic text-fg/85">{TIER_LABELS[tier]}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted/60 group-hover:text-[hsl(var(--ember)/0.7)]">
        {TIER_BLURB[tier]}
      </span>
    </button>
  );
}

function RoomBar({ code }: { code: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-md items-center justify-between">
      <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-muted/60">room</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember)/0.7)]">{code}</span>
    </div>
  );
}

function BedtimeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 -my-2 rounded-md bg-[#0a0808] px-4 py-12 sm:-mx-6 sm:py-16">
      {children}
    </div>
  );
}

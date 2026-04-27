"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import type { DRRemoteState, DRRemoteAction, DRLocks } from "./remote";
import type { DeckCard } from "./decks";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const DateRouletteRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as DRRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: DRRemoteAction) => void;
  const completedRef = useRef(false);
  useScrollToTop(state ? state.kind + "-" + (state.kind === "rolling" ? state.cards.activity.label.slice(0, 16) : "saved") : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "saved") return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${state.cards.vibe.label} · ${state.cards.budget.label} — ${state.cards.activity.label}`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Spinning…</p>
      </section>
    );
  }

  const code = remote.code;

  if (state.kind === "saved") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Locked in</p>
          <h2 className="mt-2 font-display text-3xl italic">Go.</h2>
          <div className="mt-8 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-8 text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">vibe · budget</p>
            <p className="mt-1 font-display text-2xl italic text-[hsl(var(--ember))]">{state.cards.vibe.label} · {state.cards.budget.label}</p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">activity</p>
            <p className="mt-1 font-display text-xl italic leading-snug text-fg">{state.cards.activity.label}</p>
          </div>
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "reset" })}
              className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted"
            >
              Spin again
            </button>
          )}
          <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  // rolling
  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Three decks</p>
        <h2 className="mt-2 font-display text-3xl italic">Lock what you like. Reroll the rest.</h2>

        <DeckPanel
          label="Vibe"
          card={state.cards.vibe}
          locked={state.locks.vibe}
          onToggle={() => dispatch({ type: "toggle-lock", deck: "vibe" })}
        />
        <DeckPanel
          label="Budget"
          card={state.cards.budget}
          locked={state.locks.budget}
          onToggle={() => dispatch({ type: "toggle-lock", deck: "budget" })}
        />
        <DeckPanel
          label="Activity"
          card={state.cards.activity}
          locked={state.locks.activity}
          onToggle={() => dispatch({ type: "toggle-lock", deck: "activity" })}
          bigger
        />

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: "reroll" })}
            disabled={state.locks.vibe && state.locks.budget && state.locks.activity}
            className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg disabled:opacity-40"
          >
            Reroll
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "lock-in" })}
            className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
          >
            Lock it in →
          </button>
        </div>
      </section>
    </RemoteFrame>
  );
};

function DeckPanel({ label, card, locked, onToggle, bigger = false }: {
  label: string;
  card: DeckCard;
  locked: boolean;
  onToggle: () => void;
  bigger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={locked}
      className={`mt-4 block w-full rounded-md border bg-bg/40 p-5 text-left transition-colors ${
        locked
          ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.08)]"
          : "border-border hover:border-[hsl(var(--ember)/0.5)]"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{label}</span>
        <span className={`font-mono text-[9px] uppercase tracking-[0.3em] ${locked ? "text-[hsl(var(--ember))]" : "text-muted/60"}`}>
          {locked ? "locked" : "tap to lock"}
        </span>
      </div>
      <p className={`mt-2 font-display italic text-fg ${bigger ? "text-xl leading-snug" : "text-2xl"}`}>
        {card.label}
      </p>
      {card.sub && <p className="mt-1 text-xs text-muted">{card.sub}</p>}
    </button>
  );
}

function RemoteFrame({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-md items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">room</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">{code}</span>
      </div>
      {children}
    </div>
  );
}

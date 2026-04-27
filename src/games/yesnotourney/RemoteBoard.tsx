"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { RUNGS, TOTAL_RUNGS } from "./rungs";
import type { YNTRemoteState, YNTRemoteAction } from "./remote";

interface Props extends GameComponentProps { remote: RemoteContext; }

export const YesNoTourneyRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as YNTRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: YNTRemoteAction) => void;
  const completedRef = useRef(false);
  useScrollToTop(state ? state.kind + ("rungIdx" in state ? `-${state.rungIdx}` : "") : "loading");

  useEffect(() => {
    if (!isHost || !state) return;
    if (state.kind !== "won" && state.kind !== "summit") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const winnerIds = state.kind === "summit"
      ? players.map((p) => p.id)
      : [players[state.loser === 0 ? 1 : 0]?.id ?? players[0].id];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`rung ${state.rungCleared} / ${TOTAL_RUNGS}`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Setting up…</p>
      </section>
    );
  }

  const a = players[0];
  const b = players[1] ?? players[0];
  const code = remote.code;
  const myWhose: 0 | 1 = isHost ? 0 : 1;
  const nameOf = (whose: 0 | 1) => (whose === 0 ? a : b).name;

  if (state.kind === "intro") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {TOTAL_RUNGS} rungs · alternating turns
          </p>
          <h2 className="mt-2 font-display text-4xl italic leading-tight">
            Climb together.<br/>First refusal loses.
          </h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            {a.name} starts. Each rung gets warmer. Saying NO ends the round and the other
            player wins. Either of you can quit at any time.
          </p>
          {isHost ? (
            <button type="button" onClick={() => dispatch({ type: "begin" })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
              Begin →
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host…</p>
          )}
          <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "won") {
    const winnerName = nameOf(state.loser === 0 ? 1 : 0);
    const loserName = nameOf(state.loser);
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Round</p>
          <h2 className="mt-2 font-display text-5xl italic">{winnerName}</h2>
          <p className="mt-2 font-display text-2xl italic text-[hsl(var(--ember))]">wins.</p>
          <p className="mt-6 text-sm text-muted">{loserName} stopped at rung {state.rungCleared + 1}. Cleared {state.rungCleared} of {TOTAL_RUNGS}.</p>
          <div className="mt-10 flex gap-3">
            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  completedRef.current = false;
                  dispatch({ type: "play-again" });
                }}
                className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
              >
                Play again
              </button>
            ) : (
              <p className="flex-1 rounded-md border border-dashed border-border bg-bg/30 py-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Waiting for host…</p>
            )}
            <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
          </div>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "summit") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">All eight</p>
          <h2 className="mt-2 font-display text-5xl italic">Summit.</h2>
          <p className="mt-4 text-sm text-muted">Both of you cleared every rung. The night is yours.</p>
          <div className="mt-10 flex gap-3">
            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  completedRef.current = false;
                  dispatch({ type: "play-again" });
                }}
                className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
              >
                Play again
              </button>
            ) : (
              <p className="flex-1 rounded-md border border-dashed border-border bg-bg/30 py-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Waiting for host…</p>
            )}
            <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
          </div>
        </section>
      </RemoteFrame>
    );
  }

  // Active states: pass / dare
  const isMyTurn = myWhose === state.whose;
  const rung = RUNGS[state.rungIdx];

  if (state.kind === "pass") {
    if (!isMyTurn) {
      const otherName = nameOf(state.whose);
      return (
        <RemoteFrame code={code}>
          <section className="mx-auto max-w-md animate-fade-up text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              Rung {state.rungIdx + 1} / {TOTAL_RUNGS}
            </p>
            <h2 className="mt-6 font-display text-3xl italic">{otherName}&apos;s rung.</h2>
            <p className="mt-3 text-sm text-muted">Look away — they&apos;ll show you what happens.</p>
            <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
            <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
              {rung.label} — {rung.intensity}
            </p>
          </section>
        </RemoteFrame>
      );
    }

    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            Rung {state.rungIdx + 1} / {TOTAL_RUNGS}
          </p>
          <h2 className="mt-6 font-display text-4xl italic">Your rung.</h2>
          <p className="mt-4 text-sm text-muted">Tap to see the dare on your screen only.</p>
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {rung.label} — {rung.intensity}
          </p>
          <button
            type="button"
            onClick={() => dispatch({ type: "reveal" })}
            className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
          >
            Show me the dare →
          </button>
        </section>
      </RemoteFrame>
    );
  }

  // dare
  if (!isMyTurn) {
    const otherName = nameOf(state.whose);
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            Rung {state.rungIdx + 1} / {TOTAL_RUNGS}
          </p>
          <h2 className="mt-6 font-display text-3xl italic">{otherName} is reading.</h2>
          <p className="mt-4 text-sm text-muted">Yes — they climb. No — you win.</p>
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
          <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {rung.label} — {rung.intensity}
          </p>
        </section>
      </RemoteFrame>
    );
  }

  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>You — rung {state.rungIdx + 1}</span>
          <span>{rung.label}</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-12 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{rung.intensity}</p>
          <h2 className="mt-3 font-display text-2xl italic leading-snug text-fg">{state.dare}</h2>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: "no" })}
            className="rounded-md border border-border py-5 font-display text-2xl italic text-muted hover:text-fg"
          >
            No
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "yes" })}
            className="rounded-md bg-[hsl(var(--ember))] py-5 font-display text-2xl italic text-bg"
          >
            Yes
          </button>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "reroll" })}
          disabled={state.rerolled}
          className="mt-4 w-full rounded-md border border-border py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted disabled:opacity-40"
        >
          {state.rerolled ? "Re-rolled" : "Re-roll (once)"}
        </button>
      </section>
    </RemoteFrame>
  );
};

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

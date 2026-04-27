"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { ROUND_LIMIT_SEC, TOTAL_ROUNDS } from "./remote";
import type { CTRemoteState, CTRemoteAction } from "./remote";

interface Props extends GameComponentProps { remote: RemoteContext; }

export const CharadesTwoRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as CTRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: CTRemoteAction) => void;
  const completedRef = useRef(false);
  const [, setTick] = useState(0);
  useScrollToTop(state?.kind ?? "loading");

  // Tick the clock so the timer UI updates.
  useEffect(() => {
    if (!state || state.kind !== "playing") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [state?.kind]);

  // Host fires time-up when the timer hits 0.
  useEffect(() => {
    if (!isHost || !state || state.kind !== "playing") return;
    const elapsed = Date.now() - state.startedAt;
    if (elapsed >= state.durationMs) {
      dispatch({ type: "time-up" });
      return;
    }
    const wait = state.durationMs - elapsed + 50;
    const id = window.setTimeout(() => dispatch({ type: "time-up" }), wait);
    return () => window.clearTimeout(id);
  }, [isHost, state, dispatch]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const aWin = state.scoreA > state.scoreB;
    const tie = state.scoreA === state.scoreB;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: tie ? players.map((p) => p.id) : [players[aWin ? 0 : 1]?.id ?? players[0].id],
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${state.scoreA} – ${state.scoreB}`],
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

  if (state.kind === "intro") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            {TOTAL_ROUNDS} rounds · {ROUND_LIMIT_SEC}s each
          </p>
          <h2 className="mt-2 font-display text-4xl italic leading-tight">
            Couples-only deck.<br/>No celebrities.
          </h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            Actor sees the prompt on their phone; guesser sees only the timer. Tap got-it /
            skip / next on the actor's device. Alternate per round.
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

  if (state.kind === "end") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Final</p>
          <h2 className="mt-2 font-display text-5xl italic">{state.scoreA} – {state.scoreB}</h2>
          <p className="mt-4 font-display text-2xl italic text-[hsl(var(--ember))]">
            {state.scoreA === state.scoreB ? "Tied." : `${(state.scoreA > state.scoreB ? a : b).name} wins.`}
          </p>
          <button type="button" onClick={onQuit} className="mt-10 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "round-end") {
    const actorName = (state.actor === 0 ? a : b).name;
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Time</p>
          <h2 className="mt-2 font-display text-4xl italic">{actorName} got {state.got}</h2>
          <p className="mt-4 text-sm text-muted">{state.skipped} skipped · running: {state.scoreA} – {state.scoreB}</p>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "next-round" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              {state.round + 1 >= TOTAL_ROUNDS ? "See final →" : "Next round →"}
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host…</p>
          )}
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "pre") {
    const actorName = (state.actor === 0 ? a : b).name;
    const guesserName = (state.actor === 0 ? b : a).name;
    const isMeActor = myWhose === state.actor;
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            Round {state.round + 1} / {TOTAL_ROUNDS}
          </p>
          <h2 className="mt-2 font-display text-4xl italic">{actorName} acts.<br/>{guesserName} guesses.</h2>
          {isMeActor ? (
            <>
              <p className="mt-4 text-sm text-muted">You act this round. Tap to see your prompt.</p>
              <button type="button" onClick={() => dispatch({ type: "show-prompt" })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
                Show me the prompt →
              </button>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-muted">{actorName} sees the prompt on their phone. You'll guess out loud as they perform.</p>
              <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for {actorName}…</p>
            </>
          )}
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "show-prompt") {
    const isMeActor = myWhose === state.actor;
    const actorName = (state.actor === 0 ? a : b).name;
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up">
          {isMeActor ? (
            <>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Private — actor only</p>
              <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-12 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{state.prompt.category}</p>
                <h2 className="mt-3 font-display text-3xl italic leading-snug text-fg">{state.prompt.text}</h2>
              </div>
              <button type="button" onClick={() => dispatch({ type: "start-timer" })} className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
                Start {ROUND_LIMIT_SEC}s timer →
              </button>
            </>
          ) : (
            <section className="text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Get ready</p>
              <h2 className="mt-2 font-display text-3xl italic">{actorName} is reading the prompt.</h2>
              <p className="mt-4 text-sm text-muted">Watch them. The timer starts in a moment.</p>
              <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
            </section>
          )}
        </section>
      </RemoteFrame>
    );
  }

  // playing
  const elapsedMs = Date.now() - state.startedAt;
  const remaining = Math.max(0, Math.ceil((state.durationMs - elapsedMs) / 1000));
  const isMeActor = myWhose === state.actor;
  const actorName = (state.actor === 0 ? a : b).name;

  if (!isMeActor) {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{actorName} acting</p>
          <p className={`mt-4 font-display text-7xl italic ${remaining <= 10 ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
            {String(remaining).padStart(2, "0")}s
          </p>
          <p className="mt-6 text-sm leading-relaxed text-muted">Watch and guess out loud.</p>
          <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{state.got} got · {state.skipped} skipped</p>
        </section>
      </RemoteFrame>
    );
  }

  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>You — actor</span>
          <span className={remaining <= 10 ? "text-[hsl(var(--ember))]" : ""}>
            {String(remaining).padStart(2, "0")}s
          </span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-14 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{state.prompt.category}</p>
          <h2 className="mt-3 font-display text-3xl italic leading-snug text-fg">{state.prompt.text}</h2>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => dispatch({ type: "skip" })} className="rounded-md border border-border py-4 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg">
            Skip
          </button>
          <button type="button" onClick={() => dispatch({ type: "got" })} className="rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg">
            Got it ✓
          </button>
        </div>
        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {state.got} got · {state.skipped} skipped
        </p>
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

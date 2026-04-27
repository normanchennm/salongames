"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { SETS, TOTAL } from "./prompts";
import type { ThirtySixRemoteState, ThirtySixRemoteAction } from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const ThirtySixRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as ThirtySixRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: ThirtySixRemoteAction) => void;
  const completedRef = useRef(false);
  useScrollToTop(state ? state.kind + ("set" in state ? `-${state.set}` : "") + ("index" in state ? `-${state.index}` : "") : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: ["All 36 questions answered"],
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

  // Two-name framing pulled from the roster — matches local behaviour
  // where the first two players are addressed by name.
  const a = players[0];
  const b = players[1] ?? players[0];
  const code = remote.code;

  if (state.kind === "intro") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            Three sets, twelve each
          </p>
          <h2 className="mt-2 font-display text-4xl italic leading-tight">
            Slowly. Honestly.<br/>Eye contact when you can.
          </h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            Aron’s sequence. Both partners answer every question on their own phone — read,
            answer aloud, then advance.
          </p>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "begin" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Begin Set I →
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host to begin…</p>
          )}
          <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "set-intro") {
    const set = SETS[state.set];
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
            {set.name} of III
          </p>
          <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
            {set.subtitle}
          </h2>
          <p className="mt-8 text-xs leading-relaxed text-muted">
            Twelve questions. {a.name} answers first, then {b.name}.
          </p>
          <button
            type="button"
            onClick={() => dispatch({ type: "begin-set" })}
            className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Begin →
          </button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "end") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">End of sequence</p>
          <h2 className="mt-2 font-display text-4xl italic">36 down.</h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            Aron’s study ended with four minutes of unbroken eye contact.
          </p>
          <button type="button" onClick={onQuit} className="mt-10 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  // playing
  const set = SETS[state.set];
  const q = set.questions[state.index];
  const turnPlayer = state.whoseTurn === 0 ? a : b;
  const totalIdx = SETS.slice(0, state.set).reduce((n, s) => n + s.questions.length, 0) + state.index + 1;
  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{set.name} · {state.index + 1} / {set.questions.length}</span>
          <span>Q {totalIdx} / {TOTAL}</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-12">
          <h2 className="font-display text-2xl italic leading-snug text-fg">{q}</h2>
        </div>
        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">
          {turnPlayer.name} answers
        </p>
        <button
          type="button"
          onClick={() => dispatch({ type: "advance" })}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {state.whoseTurn === 0 ? `${b.name}'s turn →` : state.index + 1 >= set.questions.length ? "End set →" : "Next question →"}
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

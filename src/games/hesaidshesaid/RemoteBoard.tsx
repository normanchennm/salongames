"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { ROUND_SIZE } from "./prompts";
import { fuzzyMatch, RevealRow } from "./Board";
import type { HSSRemoteState, HSSRemoteAction } from "./remote";

interface Props extends GameComponentProps { remote: RemoteContext; }

export const HesaidshesaidRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as HSSRemoteState | null;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: HSSRemoteAction) => void;
  const completedRef = useRef(false);
  useScrollToTop(state ? state.kind + ("round" in state ? `-${state.round}` : "") : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    let total = 0;
    for (const r of state.rounds) {
      if (fuzzyMatch(r.aGuess, r.bOwn)) total += 1;
      if (fuzzyMatch(r.bGuess, r.aOwn)) total += 1;
    }
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${total} / ${ROUND_SIZE * 2} reads`],
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
  const myName = (myWhose === 0 ? a : b).name;
  const otherName = (myWhose === 0 ? b : a).name;

  if (state.kind === "intro") {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{ROUND_SIZE} prompts</p>
          <h2 className="mt-2 font-display text-4xl italic leading-tight">
            You write what you'd say.<br/>You guess what they'd say.
          </h2>
          <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
            Each prompt: privately write your own answer + your guess of theirs. Up to 2 points
            per round. The score is incidental — the gaps are the point.
          </p>
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "begin" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
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
    let total = 0;
    const per = state.rounds.map((r) => {
      let s = 0;
      if (fuzzyMatch(r.aGuess, r.bOwn)) s += 1;
      if (fuzzyMatch(r.bGuess, r.aOwn)) s += 1;
      total += s;
      return s;
    });
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Total</p>
          <h2 className="mt-2 font-display text-5xl italic">{total} / {ROUND_SIZE * 2}</h2>
          <ul className="mt-6 grid grid-cols-2 gap-2">
            {per.map((n, i) => (
              <li key={i} className="rounded-md border border-border bg-bg/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                <span className="text-[hsl(var(--ember))]">+{n}</span> · {state.rounds[i].prompt.slice(0, 30)}…
              </li>
            ))}
          </ul>
          <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Leave room</button>
        </section>
      </RemoteFrame>
    );
  }

  if (state.kind === "reveal") {
    const r = state.rounds[state.round];
    const aMatch = fuzzyMatch(r.aGuess, r.bOwn);
    const bMatch = fuzzyMatch(r.bGuess, r.aOwn);
    const points = (aMatch ? 1 : 0) + (bMatch ? 1 : 0);
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <span>Round {state.round + 1} / {ROUND_SIZE}</span>
            <span className="text-[hsl(var(--ember))]">+{points}</span>
          </div>
          <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-6">
            <p className="font-display text-xl italic leading-snug text-fg">{r.prompt}</p>
          </div>
          <RevealRow label={a.name} own={r.aOwn} guess={r.bGuess} match={bMatch} />
          <RevealRow label={b.name} own={r.bOwn} guess={r.aGuess} match={aMatch} />
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "next" })}
              className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              {state.round + 1 >= ROUND_SIZE ? "See total →" : "Next prompt →"}
            </button>
          ) : (
            <p className="mt-8 rounded-md border border-dashed border-border bg-bg/30 py-3 text-center font-mono text-[11px] uppercase tracking-wider text-muted">Waiting for host to advance…</p>
          )}
        </section>
      </RemoteFrame>
    );
  }

  // answering
  const round = state.rounds[state.round];
  const myOwn = myWhose === 0 ? state.aOwnDraft : state.bOwnDraft;
  const myGuess = myWhose === 0 ? state.aGuessDraft : state.bGuessDraft;
  const mySubmitted = myWhose === 0 ? state.aSubmitted : state.bSubmitted;
  const partnerSubmitted = myWhose === 0 ? state.bSubmitted : state.aSubmitted;

  if (mySubmitted) {
    return (
      <RemoteFrame code={code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{myName} submitted</p>
          <h2 className="mt-4 font-display text-3xl italic">Waiting on {otherName}.</h2>
          <p className="mt-4 text-sm text-muted">
            {partnerSubmitted ? "Both in — reveal coming up." : "They're still answering. Hang tight."}
          </p>
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        </section>
      </RemoteFrame>
    );
  }

  const canSubmit = myOwn.trim().length > 0 && myGuess.trim().length > 0;

  return (
    <RemoteFrame code={code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{myName} — private</span>
          <span>{state.round + 1} / {ROUND_SIZE}</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.06)] px-6 py-6">
          <p className="font-display text-xl italic leading-snug text-fg">{round.prompt}</p>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Your honest answer
        </p>
        <textarea
          value={myOwn}
          onChange={(e) => dispatch({ type: "set-draft", whose: myWhose, field: "own", value: e.target.value })}
          rows={2}
          placeholder={`What you'd actually say…`}
          maxLength={140}
          className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        />
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          Your guess at {otherName}'s answer
        </p>
        <textarea
          value={myGuess}
          onChange={(e) => dispatch({ type: "set-draft", whose: myWhose, field: "guess", value: e.target.value })}
          rows={2}
          placeholder={`What you think ${otherName} would say…`}
          maxLength={140}
          className="mt-2 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
        />
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => dispatch({ type: "submit", whose: myWhose })}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
        >
          Lock in →
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

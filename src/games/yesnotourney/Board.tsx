"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { RUNGS, TOTAL_RUNGS, pickDare } from "./rungs";
import { YesNoTourneyRemoteBoard } from "./RemoteBoard";

/** Yes / No Tournament — single-elimination ladder.
 *
 *  Two players. Alternating turns up the ladder (rung 1 = A, rung 2 =
 *  B, rung 3 = A, …). On each turn the active player sees the dare and
 *  picks YES (does it, climbs) or NO (refuses, the OTHER player wins).
 *  Re-roll once per turn for a different dare at the same rung.
 *
 *  Either player can quit at any rung — the score is whichever rung
 *  was last cleared. The whole point is that quitting is fine. */

type Phase =
  | { kind: "intro" }
  | { kind: "pass"; rungIdx: number; whose: 0 | 1 }       // pass-screen
  | { kind: "dare"; rungIdx: number; whose: 0 | 1; dare: string; rerolled: boolean }
  | { kind: "won"; loser: 0 | 1; rungCleared: number }     // someone said no
  | { kind: "summit"; rungCleared: number };               // both cleared all rungs

export const YesNoTourneyBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <YesNoTourneyRemoteBoard {...props} remote={props.remote} />;
  return <YesNoTourneyLocalBoard {...props} />;
};

const YesNoTourneyLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(phase.kind + ("rungIdx" in phase ? `-${phase.rungIdx}` : ""));

  const a = players[0];
  const b = players[1] ?? players[0];
  const nameOf = (whose: 0 | 1) => (whose === 0 ? a : b).name;

  function start() {
    setPhase({ kind: "pass", rungIdx: 0, whose: 0 });
  }

  function reveal(rungIdx: number, whose: 0 | 1) {
    setPhase({ kind: "dare", rungIdx, whose, dare: pickDare(rungIdx), rerolled: false });
  }

  function reroll() {
    if (phase.kind !== "dare" || phase.rerolled) return;
    setPhase({ ...phase, dare: pickDare(phase.rungIdx, phase.dare), rerolled: true });
  }

  function yes() {
    if (phase.kind !== "dare") return;
    const nextRung = phase.rungIdx + 1;
    if (nextRung >= TOTAL_RUNGS) {
      setPhase({ kind: "summit", rungCleared: TOTAL_RUNGS });
      return;
    }
    setPhase({ kind: "pass", rungIdx: nextRung, whose: phase.whose === 0 ? 1 : 0 });
  }

  function no() {
    if (phase.kind !== "dare") return;
    setPhase({ kind: "won", loser: phase.whose, rungCleared: phase.rungIdx });
  }

  function endRound(rungCleared: number, winnerIdx: 0 | 1 | "tie") {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: winnerIdx === "tie"
        ? players.map((p) => p.id)
        : [players[winnerIdx]?.id ?? players[0].id],
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`rung ${rungCleared} / ${TOTAL_RUNGS}`],
    });
  }

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {TOTAL_RUNGS} rungs · alternating turns
        </p>
        <h2 className="mt-2 font-display text-4xl italic leading-tight">
          Climb together.<br/>First refusal loses.
        </h2>
        <p className="mt-4 max-w-sm mx-auto text-sm leading-relaxed text-muted">
          {a.name} starts at rung 1. {b.name} takes rung 2. Alternate. Each rung gets warmer.
          Saying NO ends the round and the other player wins. Either of you can quit at any
          time — the rung you cleared sticks.
        </p>
        <button
          type="button"
          onClick={start}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Begin — pass to {a.name} →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "pass") {
    const me = nameOf(phase.whose);
    const other = nameOf(phase.whose === 0 ? 1 : 0);
    const rung = RUNGS[phase.rungIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Rung {phase.rungIdx + 1} / {TOTAL_RUNGS}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">{me}, your rung.</h2>
        <p className="mt-4 text-sm text-muted">{other}, look away. They&apos;ll show you what happens.</p>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {rung.label} — {rung.intensity}
        </p>
        <button
          type="button"
          onClick={() => reveal(phase.rungIdx, phase.whose)}
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Show me the dare →
        </button>
      </section>
    );
  }

  if (phase.kind === "dare") {
    const me = nameOf(phase.whose);
    const rung = RUNGS[phase.rungIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{me} — rung {phase.rungIdx + 1}</span>
          <span>{rung.label}</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-12 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{rung.intensity}</p>
          <h2 className="mt-3 font-display text-2xl italic leading-snug text-fg">{phase.dare}</h2>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={no}
            className="rounded-md border border-border py-5 font-display text-2xl italic text-muted hover:text-fg"
          >
            No
          </button>
          <button
            type="button"
            onClick={yes}
            className="rounded-md bg-[hsl(var(--ember))] py-5 font-display text-2xl italic text-bg"
          >
            Yes
          </button>
        </div>
        <button
          type="button"
          onClick={reroll}
          disabled={phase.rerolled}
          className="mt-4 w-full rounded-md border border-border py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted disabled:opacity-40"
        >
          {phase.rerolled ? "Re-rolled" : "Re-roll (once)"}
        </button>
        <button
          type="button"
          onClick={() => endRound(phase.rungIdx, "tie")}
          className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.25em] text-muted"
        >
          Quit · keep rung {phase.rungIdx} cleared
        </button>
      </section>
    );
  }

  if (phase.kind === "won") {
    const winner = nameOf(phase.loser === 0 ? 1 : 0);
    const loser = nameOf(phase.loser);
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Round</p>
        <h2 className="mt-2 font-display text-5xl italic">{winner}</h2>
        <p className="mt-2 font-display text-2xl italic text-[hsl(var(--ember))]">wins.</p>
        <p className="mt-6 text-sm text-muted">{loser} stopped at rung {phase.rungCleared + 1}. Cleared {phase.rungCleared} of {TOTAL_RUNGS}.</p>
        <button
          type="button"
          onClick={() => endRound(phase.rungCleared, phase.loser === 0 ? 1 : 0)}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
        >
          Save & finish
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // summit
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">All eight</p>
      <h2 className="mt-2 font-display text-5xl italic">Summit.</h2>
      <p className="mt-4 text-sm text-muted">Both of you cleared every rung. The night is yours.</p>
      <button
        type="button"
        onClick={() => endRound(TOTAL_RUNGS, "tie")}
        className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
      >
        Save & finish
      </button>
      <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
    </section>
  );
};

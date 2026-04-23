"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, CELEBRITY_CUES } from "@/lib/narrator";

/** Celebrity / Name in the Hat.
 *
 *  Setup: each player privately types 3 names (celebrities, fictional
 *  characters, historical figures — anyone recognizable). Names go
 *  into a shared "hat".
 *
 *  Gameplay: 3 rounds, same hat of names, different rules:
 *   1. Describe — actor describes in full sentences, no saying name
 *   2. One-word — actor gives one single word per name
 *   3. Charades — silent, act out only
 *
 *  Each round, teams alternate actors with a 60s timer. Actor taps
 *  "Got it" for each guessed name, "Skip" to pass. When the hat
 *  empties, round ends; reshuffle for the next round.
 *
 *  Scored by named (correct) per player. Winner at end of Round 3. */

const ROUND_RULES = [
  { name: "Describe", rule: "Full sentences. Don't say the name or obvious parts." },
  { name: "One Word", rule: "One word per name. That's it." },
  { name: "Charades", rule: "Silent. Act it out only." },
];
const ROUND_SECONDS = 60;
const NAMES_PER_PLAYER = 3;

type Phase =
  | { kind: "setup-intro" }
  | { kind: "setup-player"; playerIndex: number; names: [string, string, string] }
  | { kind: "round-intro"; round: number; actorIndex: number; hat: string[]; scores: Record<string, number> }
  | { kind: "playing"; round: number; actorIndex: number; hat: string[]; remaining: string[]; current: string; startedAt: number; endsAt: number; scoredThisTurn: string[]; scores: Record<string, number> }
  | { kind: "turn-end"; round: number; actorIndex: number; hat: string[]; scoredThisTurn: string[]; scores: Record<string, number> }
  | { kind: "round-end"; round: number; scores: Record<string, number> }
  | { kind: "end"; scores: Record<string, number> };

export const CelebrityBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [collectedNames, setCollectedNames] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "setup-intro" });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase.kind !== "playing") return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [phase.kind]);

  // Narration. roundStart on each playing-phase entry. tenSecondsLeft
  // once per turn when clock crosses 10s. timeUp when timer hits zero.
  // winner on final end screen.
  const tenSecondsFiredRef = useRef(false);
  const timeUpFiredRef = useRef(false);
  useEffect(() => {
    if (phase.kind === "playing") {
      tenSecondsFiredRef.current = false;
      timeUpFiredRef.current = false;
      playCue(CELEBRITY_CUES.roundStart);
    }
    if (phase.kind === "end") playCue(CELEBRITY_CUES.winner);
  }, [phase.kind]);

  useScrollToTop(phase.kind + ("playerIndex" in phase ? `-${phase.playerIndex}` : "") + ("actorIndex" in phase ? `-${phase.actorIndex}` : ""));

  function finishGame(scores: Record<string, number>) {
    const max = Math.max(...Object.values(scores), 0);
    const winnerIds = Object.entries(scores).filter(([, s]) => s === max).map(([id]) => id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([id, s]) => {
          const p = players.find((pl) => pl.id === id);
          return `${p?.name ?? "?"}: ${s} names`;
        }),
    });
  }

  // --- SETUP INTRO --- -------------------------------------------
  if (phase.kind === "setup-intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic leading-tight">
          Each player adds {NAMES_PER_PLAYER} entries to the hat.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Names, words, or phrases — anything the table would recognize. Pass the phone and type privately. Three rounds follow: describe, one word, charades.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "setup-player", playerIndex: 0, names: ["", "", ""] })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start — pass to {players[0].name} →
        </button>
      </section>
    );
  }

  // --- SETUP (per player) --- ------------------------------------
  if (phase.kind === "setup-player") {
    const current = players[phase.playerIndex];
    const canSubmit = phase.names.every((n) => n.trim().length > 0);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Pass to {current.name} — privately
        </p>
        <h2 className="mt-2 font-display text-3xl italic">Add {NAMES_PER_PLAYER} entries.</h2>
        <p className="mt-2 text-sm text-muted">
          Nobody else should see. Names, words, or phrases the table will know — mix obvious and tricky.
        </p>
        <div className="mt-6 space-y-3">
          {phase.names.map((n, i) => (
            <input
              key={i}
              type="text"
              value={n}
              onChange={(e) => {
                const next = [...phase.names] as [string, string, string];
                next[i] = e.target.value;
                setPhase({ ...phase, names: next });
              }}
              placeholder={`Entry ${i + 1}`}
              maxLength={50}
              className="w-full rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)]"
            />
          ))}
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            const updated = [...collectedNames, ...phase.names.map((n) => n.trim())];
            const next = phase.playerIndex + 1;
            if (next >= players.length) {
              // shuffle + start round 1
              const shuffled = updated.slice().sort(() => Math.random() - 0.5);
              setCollectedNames(updated);
              const scores = Object.fromEntries(players.map((p) => [p.id, 0]));
              setPhase({ kind: "round-intro", round: 0, actorIndex: 0, hat: shuffled, scores });
            } else {
              setCollectedNames(updated);
              setPhase({ kind: "setup-player", playerIndex: next, names: ["", "", ""] });
            }
          }}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Hide & pass →
        </button>
      </section>
    );
  }

  // --- ROUND INTRO --- -------------------------------------------
  if (phase.kind === "round-intro") {
    const rule = ROUND_RULES[phase.round];
    const actor = players[phase.actorIndex % players.length];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
          Round {phase.round + 1} / 3 · {phase.hat.length} names in the hat
        </p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{rule.name}</h2>
        <p className="mt-3 text-sm text-muted">{rule.rule}</p>
        <p className="mt-8 font-display text-2xl italic">Actor: {actor.name}</p>
        <button
          type="button"
          onClick={() => {
            if (phase.hat.length === 0) {
              setPhase({ kind: "round-end", round: phase.round, scores: phase.scores });
              return;
            }
            const [current, ...remaining] = phase.hat;
            setPhase({
              kind: "playing",
              round: phase.round,
              actorIndex: phase.actorIndex,
              hat: phase.hat,
              remaining,
              current,
              startedAt: Date.now(),
              endsAt: Date.now() + ROUND_SECONDS * 1000,
              scoredThisTurn: [],
              scores: phase.scores,
            });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start 60s timer →
        </button>
      </section>
    );
  }

  // --- PLAYING --- -----------------------------------------------
  if (phase.kind === "playing") {
    const remaining = Math.max(0, Math.ceil((phase.endsAt - now) / 1000));
    const timedOut = remaining <= 0;
    const actor = players[phase.actorIndex % players.length];

    if (remaining === 10 && !tenSecondsFiredRef.current) {
      tenSecondsFiredRef.current = true;
      playCue(CELEBRITY_CUES.tenSecondsLeft);
    }

    // Timeout auto-transition
    if (timedOut) {
      if (!timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        playCue(CELEBRITY_CUES.timeUp);
      }
      setTimeout(() => {
        setPhase({
          kind: "turn-end",
          round: phase.round,
          actorIndex: phase.actorIndex,
          hat: phase.current ? [phase.current, ...phase.remaining] : phase.remaining,
          scoredThisTurn: phase.scoredThisTurn,
          scores: phase.scores,
        });
      }, 0);
    }

    const advance = (gotIt: boolean) => {
      const newScores = gotIt
        ? { ...phase.scores, [actor.id]: phase.scores[actor.id] + 1 }
        : phase.scores;
      const newScored = gotIt
        ? [...phase.scoredThisTurn, phase.current]
        : phase.scoredThisTurn;
      // skipped → push name to back of hat (still in play this round)
      const nextHat = gotIt ? phase.remaining : [...phase.remaining, phase.current];
      if (nextHat.length === 0) {
        // round finished mid-timer
        setPhase({
          kind: "turn-end",
          round: phase.round,
          actorIndex: phase.actorIndex,
          hat: [],
          scoredThisTurn: newScored,
          scores: newScores,
        });
        return;
      }
      const [current, ...remaining] = nextHat;
      setPhase({
        ...phase,
        remaining,
        current,
        hat: nextHat,
        scoredThisTurn: newScored,
        scores: newScores,
      });
    };

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{actor.name} · {ROUND_RULES[phase.round].name}</span>
          <span className={remaining <= 10 ? "text-[hsl(var(--ember))]" : ""}>
            {String(remaining).padStart(2, "0")}s
          </span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.06)] px-6 py-14 text-center">
          <h2 className="font-display text-4xl italic text-fg">{phase.current}</h2>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => advance(false)}
            className="rounded-md border border-border py-4 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => advance(true)}
            className="rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Got it ✓
          </button>
        </div>
        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {phase.scoredThisTurn.length} this turn · {phase.hat.length} left in hat
        </p>
      </section>
    );
  }

  // --- TURN END --- ----------------------------------------------
  if (phase.kind === "turn-end") {
    const actor = players[phase.actorIndex % players.length];
    const nextActor = phase.actorIndex + 1;
    const hatEmpty = phase.hat.length === 0;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Turn over</p>
        <h2 className="mt-2 font-display text-3xl italic">{actor.name} scored {phase.scoredThisTurn.length}.</h2>
        {hatEmpty ? (
          <>
            <p className="mt-4 text-sm text-muted">Hat is empty. Round {phase.round + 1} complete.</p>
            <button
              type="button"
              onClick={() => setPhase({ kind: "round-end", round: phase.round, scores: phase.scores })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              See round scores →
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPhase({ kind: "round-intro", round: phase.round, actorIndex: nextActor, hat: phase.hat, scores: phase.scores })}
            className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Pass to {players[nextActor % players.length].name} →
          </button>
        )}
      </section>
    );
  }

  // --- ROUND END --- ---------------------------------------------
  if (phase.kind === "round-end") {
    const nextRound = phase.round + 1;
    const sorted = Object.entries(phase.scores).sort(([, a], [, b]) => b - a);
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Round {phase.round + 1} / 3 done</p>
        <h2 className="mt-2 font-display text-3xl italic">Running scores</h2>
        <ul className="mt-6 divide-y divide-border/60 rounded-md border border-border bg-bg/40">
          {sorted.map(([id, s]) => {
            const p = players.find((pl) => pl.id === id);
            return (
              <li key={id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-display italic text-fg">{p?.name}</span>
                <span className="font-mono tabular-nums text-muted">{s}</span>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => {
            if (nextRound >= 3) {
              setPhase({ kind: "end", scores: phase.scores });
            } else {
              // reshuffle the same names for the next round
              const reshuffled = collectedNames.slice().sort(() => Math.random() - 0.5);
              setPhase({ kind: "round-intro", round: nextRound, actorIndex: 0, hat: reshuffled, scores: phase.scores });
            }
          }}
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {nextRound >= 3 ? "See final results →" : `Round ${nextRound + 1}: ${ROUND_RULES[nextRound].name} →`}
        </button>
      </section>
    );
  }

  // --- END --- ---------------------------------------------------
  const sorted = Object.entries(phase.scores).sort(([, a], [, b]) => b - a);
  const max = sorted[0]?.[1] ?? 0;
  return (
    <section className="mx-auto max-w-lg animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Final scores</p>
      <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
        {sorted[0] ? `${players.find((p) => p.id === sorted[0][0])?.name} wins.` : "No one scored."}
      </h2>
      <ul className="mt-8 divide-y divide-border/60">
        {sorted.map(([id, score]) => {
          const p = players.find((pl) => pl.id === id);
          const winner = score === max && score > 0;
          return (
            <li key={id} className={`flex items-center justify-between py-3 ${winner ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
              <span className="font-display italic">{p?.name}</span>
              <span className="font-mono tabular-nums">{score}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => finishGame(phase.scores)}
          className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          Back to catalog
        </button>
      </div>
    </section>
  );
};

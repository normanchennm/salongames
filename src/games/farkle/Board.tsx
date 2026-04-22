"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Farkle — push-your-luck dice, 2-8 players.
 *
 *  Roll 6 dice. Keep at least one scoring die/combo, continue rolling
 *  the remainder, or bank. If a roll has NO scoring dice → Farkle,
 *  turn ends with zero. Bank all six dice and you get "hot dice" —
 *  roll all six again with turn total kept.
 *
 *  Scoring: 1 = 100 per, 5 = 50 per. Three of a kind: 1s = 1000, else
 *  face × 100 (222 = 200, 666 = 600). Four/five/six-of-a-kind double/
 *  triple/quadruple the base. Straight 1-6 = 1500. Three pairs = 1500.
 *
 *  First to 10,000. When someone crosses, every other player gets one
 *  final turn to beat them. */

const TARGET = 10000;
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function rollDice(n: number): number[] {
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
}

interface ScoreResult { score: number; valid: boolean; }

function scoreSelection(dice: number[]): ScoreResult {
  if (dice.length === 0) return { score: 0, valid: false };
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]++;
  // Special combos require exactly 6 dice.
  if (dice.length === 6) {
    if (counts.slice(1).every((c) => c === 1)) return { score: 1500, valid: true };
    const pairCount = counts.slice(1).filter((c) => c === 2).length;
    if (pairCount === 3) return { score: 1500, valid: true };
  }
  let score = 0;
  for (let face = 1; face <= 6; face++) {
    const c = counts[face];
    if (c === 0) continue;
    if (c >= 3) {
      const base = face === 1 ? 1000 : face * 100;
      const mult = c - 2;
      score += base * mult;
    } else {
      if (face === 1) score += c * 100;
      else if (face === 5) score += c * 50;
      else return { score: 0, valid: false };
    }
  }
  return { score, valid: true };
}

/** Does a rolled set contain at least one scoring possibility? */
function canScore(dice: number[]): boolean {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]++;
  if (dice.length === 6 && counts.slice(1).every((c) => c === 1)) return true;
  if (dice.length === 6 && counts.slice(1).filter((c) => c === 2).length === 3) return true;
  if (counts[1] > 0 || counts[5] > 0) return true;
  for (let f = 2; f <= 6; f++) if (counts[f] >= 3) return true;
  return false;
}

interface TurnState {
  turnIdx: number;
  turnScore: number;        // banked this turn (from previous kept combos this turn)
  dice: number[];           // currently rolled (not yet kept), selectable
  selected: boolean[];      // which are currently selected for keeping
  rollsThisTurn: number;
  farkled: boolean;
}

type Phase =
  | { kind: "intro" }
  | { kind: "roll"; turn: TurnState }
  | { kind: "turn-end"; turn: TurnState; banked: number }
  | { kind: "final-round"; leaderIdx: number; remaining: number[] }  // player indices still to play
  | { kind: "end"; winnerIdx: number };

export const FarkleBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [scores, setScores] = useState<number[]>(() => players.map(() => 0));
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [finalRoundActive, setFinalRoundActive] = useState(false);
  const [finalRoundLeader, setFinalRoundLeader] = useState<number | null>(null);
  const [finalRoundPending, setFinalRoundPending] = useState<number[]>([]);
  useScrollToTop(phase.kind + ("turn" in phase ? `-${phase.turn.turnIdx}-${phase.turn.rollsThisTurn}` : ""));

  // --- INTRO ----------------------------------------------------
  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic leading-tight">Keep the scoring dice. Push your luck.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Roll six dice, tap the ones you want to keep (must all form scoring combos), then roll again with what&apos;s left — or bank. Roll zero scoring dice and you farkle: lose the turn. Bank all six: hot dice, roll again.
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          1 = 100 · 5 = 50 · three-of-a-kind · straight · three pairs
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "roll", turn: { turnIdx: 0, turnScore: 0, dice: rollDice(6), selected: Array(6).fill(false), rollsThisTurn: 1, farkled: false } })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start — {players[0].name}&apos;s turn →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  function advanceTurn(justBanked: number) {
    const newScores = scores.slice();
    newScores[phase.kind === "roll" ? phase.turn.turnIdx : 0] += justBanked;
    // Guard: use `phase` as roll-kind (we only call this from roll/bank)
    if (phase.kind !== "roll") return;
    newScores[phase.turn.turnIdx] = scores[phase.turn.turnIdx] + justBanked;
    setScores(newScores);

    // Check if final round is active and this was the last player to go.
    if (finalRoundActive) {
      const nextPending = finalRoundPending.filter((i) => i !== phase.turn.turnIdx);
      setFinalRoundPending(nextPending);
      if (nextPending.length === 0) {
        // Determine winner.
        const maxScore = Math.max(...newScores);
        const winnerIdx = newScores.indexOf(maxScore);
        setPhase({ kind: "end", winnerIdx });
        return;
      }
      const nextIdx = nextPending[0];
      setPhase({ kind: "roll", turn: { turnIdx: nextIdx, turnScore: 0, dice: rollDice(6), selected: Array(6).fill(false), rollsThisTurn: 1, farkled: false } });
      return;
    }

    // Check if this player just hit/exceeded target → start final round.
    if (newScores[phase.turn.turnIdx] >= TARGET) {
      const leader = phase.turn.turnIdx;
      const pending: number[] = [];
      for (let k = 1; k < players.length; k++) {
        pending.push((leader + k) % players.length);
      }
      setFinalRoundActive(true);
      setFinalRoundLeader(leader);
      setFinalRoundPending(pending);
      setPhase({ kind: "roll", turn: { turnIdx: pending[0], turnScore: 0, dice: rollDice(6), selected: Array(6).fill(false), rollsThisTurn: 1, farkled: false } });
      return;
    }

    // Normal: next player.
    const nextIdx = (phase.turn.turnIdx + 1) % players.length;
    setPhase({ kind: "roll", turn: { turnIdx: nextIdx, turnScore: 0, dice: rollDice(6), selected: Array(6).fill(false), rollsThisTurn: 1, farkled: false } });
  }

  // --- ROLL -----------------------------------------------------
  if (phase.kind === "roll") {
    const t = phase.turn;
    const current = players[t.turnIdx];
    const selectedDice = t.dice.filter((_, i) => t.selected[i]);
    const selScore = scoreSelection(selectedDice);
    const validSelection = selScore.valid && selScore.score > 0;
    const isFarkle = !canScore(t.dice);

    const toggleDie = (i: number) => {
      if (isFarkle) return;
      const next = t.selected.slice();
      next[i] = !next[i];
      setPhase({ kind: "roll", turn: { ...t, selected: next } });
    };

    const rollAgain = () => {
      if (!validSelection) return;
      const kept = t.dice.filter((_, i) => t.selected[i]);
      const remaining = t.dice.filter((_, i) => !t.selected[i]);
      const newTurnScore = t.turnScore + selScore.score;
      // Hot dice: all 6 kept → roll all 6 again.
      const rollCount = remaining.length === 0 ? 6 : remaining.length;
      setPhase({
        kind: "roll",
        turn: {
          ...t,
          dice: rollDice(rollCount),
          selected: Array(rollCount).fill(false),
          turnScore: newTurnScore,
          rollsThisTurn: t.rollsThisTurn + 1,
        },
      });
      void kept;
    };

    const bank = () => {
      if (!validSelection) return;
      const banked = t.turnScore + selScore.score;
      setPhase({ kind: "turn-end", turn: { ...t, farkled: false }, banked });
    };

    const acceptFarkle = () => {
      setPhase({ kind: "turn-end", turn: { ...t, farkled: true }, banked: 0 });
    };

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>
            <span className="text-[hsl(var(--ember))]">{current.name}</span> · roll {t.rollsThisTurn}
          </span>
          <span>Turn: {t.turnScore}{validSelection ? ` (+${selScore.score})` : ""}</span>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {t.dice.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDie(i)}
              disabled={isFarkle}
              className={`flex h-16 w-16 items-center justify-center rounded-lg border text-4xl transition-colors ${
                t.selected[i]
                  ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
                  : "border-border bg-bg/60 text-fg hover:border-[hsl(var(--ember)/0.4)]"
              }`}
            >
              {DICE_FACES[d - 1]}
            </button>
          ))}
        </div>

        {isFarkle ? (
          <div className="mt-6 text-center">
            <p className="font-display text-3xl italic text-[hsl(var(--ember))]">Farkle.</p>
            <p className="mt-1 text-sm text-muted">No scoring dice in this roll. Turn points lost.</p>
            <button type="button" onClick={acceptFarkle} className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
              Pass the phone →
            </button>
          </div>
        ) : (
          <>
            {selectedDice.length > 0 && !validSelection && (
              <p className="mt-3 rounded-md border border-[hsl(var(--ember)/0.3)] bg-[hsl(var(--ember)/0.05)] px-3 py-2 text-center text-xs text-muted">
                Selection has non-scoring dice. Unselect the junk.
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={rollAgain} disabled={!validSelection} className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40">
                Roll remaining
              </button>
              <button type="button" onClick={bank} disabled={!validSelection} className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg disabled:opacity-40">
                Bank
              </button>
            </div>
          </>
        )}

        <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Scores (first to {TARGET})</p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {players.map((pl, i) => (
              <li key={pl.id} className={`flex justify-between ${i === t.turnIdx ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
                <span>{pl.name}{finalRoundActive && i === finalRoundLeader ? " ★" : ""}</span>
                <span>{scores[i]}</span>
              </li>
            ))}
          </ul>
          {finalRoundActive && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">Final round: {finalRoundPending.length} left</p>
          )}
        </div>

        <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // --- TURN END -------------------------------------------------
  if (phase.kind === "turn-end") {
    const t = phase.turn;
    const current = players[t.turnIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{current.name}&apos;s turn ends</p>
        <h2 className={`mt-2 font-display text-4xl italic ${phase.banked > 0 ? "text-[hsl(var(--ember))]" : "text-muted"}`}>
          {phase.banked > 0 ? `+${phase.banked}` : "Farkle."}
        </h2>
        <button type="button" onClick={() => advanceTurn(phase.banked)} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Continue →
        </button>
      </section>
    );
  }

  // --- END ------------------------------------------------------
  if (phase.kind === "end") {
    const winner = players[phase.winnerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Game over</p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{winner.name} wins.</h2>
        <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
          <ul className="space-y-1 font-mono text-xs">
            {players.map((p, i) => (
              <li key={p.id} className={`flex justify-between ${i === phase.winnerIdx ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
                <span>{p.name}</span>
                <span>{scores[i]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds: [winner.id],
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: [`${winner.name} reached ${TARGET}`],
              })
            }
            className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Play again
          </button>
          <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
            Back
          </button>
        </div>
      </section>
    );
  }

  return null;
};

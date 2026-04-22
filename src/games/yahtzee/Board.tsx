"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Yahtzee — 5 dice, up to 3 rolls per turn, 13 scoring categories
 *  per player. Pick any subset of dice to hold between rolls; when
 *  done, score into exactly one remaining category. Upper bonus of 35
 *  applies if the upper-section total reaches 63.
 *
 *  Max 4 players to keep a session under 30 minutes. */

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

type CategoryKey =
  | "ones" | "twos" | "threes" | "fours" | "fives" | "sixes"
  | "threeK" | "fourK" | "fullHouse" | "smallStraight" | "largeStraight" | "yahtzee" | "chance";

const CATEGORIES: { key: CategoryKey; label: string; upper: boolean }[] = [
  { key: "ones", label: "Ones", upper: true },
  { key: "twos", label: "Twos", upper: true },
  { key: "threes", label: "Threes", upper: true },
  { key: "fours", label: "Fours", upper: true },
  { key: "fives", label: "Fives", upper: true },
  { key: "sixes", label: "Sixes", upper: true },
  { key: "threeK", label: "Three of a Kind", upper: false },
  { key: "fourK", label: "Four of a Kind", upper: false },
  { key: "fullHouse", label: "Full House", upper: false },
  { key: "smallStraight", label: "Small Straight", upper: false },
  { key: "largeStraight", label: "Large Straight", upper: false },
  { key: "yahtzee", label: "Yahtzee", upper: false },
  { key: "chance", label: "Chance", upper: false },
];

function countsOf(dice: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}
function sumDice(dice: number[]): number { return dice.reduce((s, d) => s + d, 0); }
function hasSequence(dice: number[], len: number): boolean {
  const set = new Set(dice);
  for (let start = 1; start <= 6 - len + 1; start++) {
    let ok = true;
    for (let k = 0; k < len; k++) if (!set.has(start + k)) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

function scoreFor(cat: CategoryKey, dice: number[]): number {
  if (dice.length === 0) return 0;
  const c = countsOf(dice);
  switch (cat) {
    case "ones": return c[1] * 1;
    case "twos": return c[2] * 2;
    case "threes": return c[3] * 3;
    case "fours": return c[4] * 4;
    case "fives": return c[5] * 5;
    case "sixes": return c[6] * 6;
    case "threeK": return c.some((x) => x >= 3) ? sumDice(dice) : 0;
    case "fourK": return c.some((x) => x >= 4) ? sumDice(dice) : 0;
    case "fullHouse": return c.some((x) => x === 3) && c.some((x) => x === 2) ? 25 : 0;
    case "smallStraight": return hasSequence(dice, 4) ? 30 : 0;
    case "largeStraight": return hasSequence(dice, 5) ? 40 : 0;
    case "yahtzee": return c.some((x) => x === 5) ? 50 : 0;
    case "chance": return sumDice(dice);
  }
}

type Card = Partial<Record<CategoryKey, number>>;

function upperTotal(card: Card): number {
  return (card.ones ?? 0) + (card.twos ?? 0) + (card.threes ?? 0) + (card.fours ?? 0) + (card.fives ?? 0) + (card.sixes ?? 0);
}
function grandTotal(card: Card): number {
  const upper = upperTotal(card);
  const bonus = upper >= 63 ? 35 : 0;
  const lowerKeys: CategoryKey[] = ["threeK", "fourK", "fullHouse", "smallStraight", "largeStraight", "yahtzee", "chance"];
  const lower = lowerKeys.reduce((sum, k) => sum + (card[k] ?? 0), 0);
  return upper + bonus + lower;
}
function cardComplete(card: Card): boolean {
  return CATEGORIES.every((c) => card[c.key] !== undefined);
}

interface Turn { playerIdx: number; dice: number[]; held: boolean[]; rollsLeft: number; }

type Phase =
  | { kind: "intro" }
  | { kind: "turn"; turn: Turn };

function rollDice(n: number): number[] {
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
}

export const YahtzeeBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [cards, setCards] = useState<Card[]>(() => players.map(() => ({})));
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(phase.kind + ("turn" in phase ? `-${phase.turn.playerIdx}-${phase.turn.rollsLeft}` : ""));

  if (players.length > 4) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Up to 4 players</p>
        <h2 className="mt-2 font-display text-2xl italic">Yahtzee plays best at 2–4.</h2>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  function startFirstTurn() {
    setPhase({ kind: "turn", turn: { playerIdx: 0, dice: rollDice(5), held: [false, false, false, false, false], rollsLeft: 2 } });
  }

  function advanceAfterScoring(newCards: Card[]) {
    // Next player who still has an empty category.
    const allDone = newCards.every(cardComplete);
    if (allDone) {
      // End game: use placeholder kind while total is computed by render.
      setPhase({ kind: "intro" }); // will fall through to end screen below via cards check
      // Actually we need a dedicated end phase. Easier: set a fake turn and detect completion.
      return;
    }
    if (phase.kind !== "turn") return;
    let nextIdx = (phase.turn.playerIdx + 1) % players.length;
    while (cardComplete(newCards[nextIdx])) nextIdx = (nextIdx + 1) % players.length;
    setPhase({ kind: "turn", turn: { playerIdx: nextIdx, dice: rollDice(5), held: [false, false, false, false, false], rollsLeft: 2 } });
  }

  // --- INTRO + END DETECTION -----------------------------------
  if (phase.kind === "intro") {
    const anyScored = cards.some((c) => Object.keys(c).length > 0);
    const allDone = cards.every(cardComplete);
    if (allDone && anyScored) {
      // End screen
      const totals = cards.map((c) => grandTotal(c));
      const maxTotal = Math.max(...totals);
      const winnerIdx = totals.indexOf(maxTotal);
      const winner = players[winnerIdx];
      return (
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Final scores</p>
          <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{winner.name} wins.</h2>
          <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
            <ul className="space-y-1 font-mono text-xs">
              {players.map((p, i) => (
                <li key={p.id} className={`flex justify-between ${i === winnerIdx ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
                  <span>{p.name}</span>
                  <span>{totals[i]} (upper {upperTotal(cards[i])}{upperTotal(cards[i]) >= 63 ? " + 35" : ""})</span>
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
                  highlights: [`${winner.name}: ${maxTotal}`],
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
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic leading-tight">Five dice, three rolls, thirteen categories.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Each turn: roll five dice. Tap to hold any you like, then roll up to twice more. At the end, write the score into any open category — even if it&apos;s a zero. First to fill all thirteen. Highest total wins.
        </p>
        <button
          type="button"
          onClick={startFirstTurn}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start — {players[0].name}&apos;s turn →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // --- TURN -----------------------------------------------------
  const t = phase.turn;
  const current = players[t.playerIdx];
  const myCard = cards[t.playerIdx];

  const rollRemaining = () => {
    if (t.rollsLeft <= 0) return;
    const next = t.dice.slice();
    for (let i = 0; i < 5; i++) if (!t.held[i]) next[i] = 1 + Math.floor(Math.random() * 6);
    setPhase({ kind: "turn", turn: { ...t, dice: next, rollsLeft: t.rollsLeft - 1 } });
  };
  const toggleHold = (i: number) => {
    const held = t.held.slice();
    held[i] = !held[i];
    setPhase({ kind: "turn", turn: { ...t, held } });
  };
  const scoreInto = (cat: CategoryKey) => {
    if (myCard[cat] !== undefined) return;
    const value = scoreFor(cat, t.dice);
    const nextCards = cards.slice();
    nextCards[t.playerIdx] = { ...myCard, [cat]: value };
    setCards(nextCards);
    // End-of-game check.
    const allDone = nextCards.every(cardComplete);
    if (allDone) {
      setPhase({ kind: "intro" }); // will show end screen
      return;
    }
    let nextIdx = (t.playerIdx + 1) % players.length;
    while (cardComplete(nextCards[nextIdx])) nextIdx = (nextIdx + 1) % players.length;
    setPhase({ kind: "turn", turn: { playerIdx: nextIdx, dice: rollDice(5), held: [false, false, false, false, false], rollsLeft: 2 } });
  };

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span><span className="text-[hsl(var(--ember))]">{current.name}</span> · rolls left: {t.rollsLeft}</span>
        <span>Total: {grandTotal(myCard)}</span>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {t.dice.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggleHold(i)}
            className={`flex h-16 w-16 items-center justify-center rounded-lg border text-4xl transition-colors ${
              t.held[i]
                ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
                : "border-border bg-bg/60 text-fg hover:border-[hsl(var(--ember)/0.4)]"
            }`}
          >
            {DICE_FACES[d - 1]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Tap to hold. Held stays on re-roll.</p>

      <button
        type="button"
        onClick={rollRemaining}
        disabled={t.rollsLeft <= 0}
        className="mt-3 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Roll {5 - t.held.filter(Boolean).length} remaining ({t.rollsLeft} left)
      </button>

      <div className="mt-5 rounded-md border border-border bg-bg/40 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{current.name}&apos;s scorecard</p>
        <ul className="mt-2 divide-y divide-border/40">
          {CATEGORIES.map((c) => {
            const filled = myCard[c.key];
            const preview = scoreFor(c.key, t.dice);
            const isFilled = filled !== undefined;
            return (
              <li key={c.key} className="flex items-center justify-between py-1.5">
                <span className={`font-mono text-xs ${isFilled ? "text-muted" : "text-fg"}`}>
                  {c.label}{c.upper ? " (upper)" : ""}
                </span>
                {isFilled ? (
                  <span className="font-mono text-xs text-muted">{filled}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => scoreInto(c.key)}
                    className="rounded-md border border-[hsl(var(--ember)/0.5)] px-2 py-1 font-mono text-[11px] text-[hsl(var(--ember))] transition-colors hover:bg-[hsl(var(--ember)/0.1)]"
                  >
                    {preview}
                  </button>
                )}
              </li>
            );
          })}
          <li className="flex items-center justify-between pt-2 font-mono text-xs">
            <span className="text-muted">Upper total</span>
            <span className="text-fg">{upperTotal(myCard)}{upperTotal(myCard) >= 63 ? " + 35 bonus" : ""}</span>
          </li>
        </ul>
      </div>

      <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
        Quit
      </button>
    </section>
  );
};

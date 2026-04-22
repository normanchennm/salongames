"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Basic Rummy — 2-player pass-and-play. Deal 7. Draw one from stock
 *  or discard, then discard one. You may "go out" at end of your turn
 *  if your remaining 6 cards partition into valid melds (sets of 3+
 *  same rank OR runs of 3+ consecutive same suit). Partitioning is
 *  auto-checked (no manual grouping). Opponent's remaining cards are
 *  scored against them at face value (A=1, J/Q/K=10, else pip). */

const SUITS = ["♣", "♦", "♥", "♠"] as const;
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"] as const;
const RANK_VAL: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]));
type Suit = typeof SUITS[number];
type Rank = typeof RANKS[number];
interface Card { rank: Rank; suit: Suit; }

function newDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardKey(c: Card): string { return c.rank + c.suit; }

function deadwoodValue(c: Card): number {
  if (c.rank === "A") return 1;
  if (c.rank === "J" || c.rank === "Q" || c.rank === "K") return 10;
  return RANK_VAL[c.rank];
}

function validMeld(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  if (cards.every((c) => c.rank === cards[0].rank)) return true;
  if (cards.every((c) => c.suit === cards[0].suit)) {
    const sorted = cards.map((c) => RANK_VAL[c.rank]).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) return false;
    }
    return true;
  }
  return false;
}

function canPartition(hand: Card[]): boolean {
  if (hand.length === 0) return true;
  if (hand.length < 3) return false;
  // The first card must be in some meld.
  const first = hand[0];
  const rest = hand.slice(1);
  // Try subsets of size 3+ that include first.
  for (let size = 3; size <= hand.length; size++) {
    const indices: number[][] = [];
    const pick = (start: number, need: number, acc: number[]) => {
      if (need === 0) { indices.push(acc); return; }
      for (let i = start; i <= rest.length - need; i++) {
        pick(i + 1, need - 1, [...acc, i]);
      }
    };
    pick(0, size - 1, []);
    for (const combo of indices) {
      const meld = [first, ...combo.map((i) => rest[i])];
      if (!validMeld(meld)) continue;
      const remaining = rest.filter((_, i) => !combo.includes(i));
      if (canPartition(remaining)) return true;
    }
  }
  return false;
}

type Phase =
  | { kind: "pass"; turnIdx: number }
  | { kind: "turn"; turnIdx: number; drew: boolean }
  | { kind: "end"; winnerIdx: number; deadwood: number };

export const RummyBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const initial = useMemo(() => {
    const d = newDeck();
    return { h0: d.slice(0, 7), h1: d.slice(7, 14), stock: d.slice(14, 51), firstDiscard: d[51] };
  }, []);
  const [hands, setHands] = useState<Card[][]>(() => [initial.h0, initial.h1]);
  const [stock, setStock] = useState<Card[]>(() => initial.stock);
  const [discard, setDiscard] = useState<Card[]>(() => [initial.firstDiscard]);
  const [phase, setPhase] = useState<Phase>({ kind: "pass", turnIdx: 0 });
  useScrollToTop(phase.kind + ("turnIdx" in phase ? `-${phase.turnIdx}` : "") + ("drew" in phase ? `-${phase.drew}` : ""));

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "end") {
    const winner = players[phase.winnerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Rummy</p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{winner.name} wins.</h2>
        <p className="mt-2 text-sm text-muted">Opponent deadwood: {phase.deadwood} points</p>
        <div className="mt-10 flex gap-3">
          <button type="button" onClick={() => onComplete({
            playedAt: new Date().toISOString(),
            players,
            winnerIds: [winner.id],
            durationSec: Math.round((Date.now() - startedAt) / 1000),
            highlights: [`${winner.name} went out · +${phase.deadwood}`],
          })} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">Play again</button>
          <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
        </div>
      </section>
    );
  }

  if (phase.kind === "pass") {
    const p = players[phase.turnIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Your turn</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {p.name}.</h2>
        <button type="button" onClick={() => setPhase({ kind: "turn", turnIdx: phase.turnIdx, drew: false })} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          I&apos;m {p.name} — show hand →
        </button>
      </section>
    );
  }

  const p = phase;
  const current = players[p.turnIdx];
  const hand = hands[p.turnIdx];
  const sortedHand = hand.slice().sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANK_VAL[a.rank] - RANK_VAL[b.rank]);
  const topDiscard = discard[discard.length - 1];

  const drawFromStock = () => {
    if (p.drew) return;
    if (stock.length === 0) return;
    const next = stock.slice();
    const card = next.pop()!;
    setStock(next);
    const newHands = hands.map((h, i) => i === p.turnIdx ? [...h, card] : h);
    setHands(newHands);
    setPhase({ kind: "turn", turnIdx: p.turnIdx, drew: true });
  };
  const drawFromDiscard = () => {
    if (p.drew) return;
    if (!topDiscard) return;
    const next = discard.slice(0, -1);
    setDiscard(next);
    const newHands = hands.map((h, i) => i === p.turnIdx ? [...h, topDiscard] : h);
    setHands(newHands);
    setPhase({ kind: "turn", turnIdx: p.turnIdx, drew: true });
  };
  const discardCard = (c: Card) => {
    if (!p.drew) return;
    const newHands = hands.map((h, i) => i === p.turnIdx ? h.filter((x) => cardKey(x) !== cardKey(c)) : h);
    setHands(newHands);
    setDiscard([...discard, c]);
    // Check if this player can go out (remaining hand = 6 cards that partition).
    const after = newHands[p.turnIdx];
    if (canPartition(after)) {
      // They go out automatically? Classic Rummy requires declaring; for MVP, prompt.
      // We'll ask via the button, not auto — because knocking early vs delaying matters strategically. Leave to manual "Go out" button.
    }
    const nextIdx = (p.turnIdx + 1) % 2;
    setPhase({ kind: "pass", turnIdx: nextIdx });
  };
  const goOut = () => {
    // Must have drawn and not discarded (hand is 8). If hand is 7, they just discarded — their hand is 7; can they go out with 7 cards?
    // Actually in our 7-card Rummy: after discard, hand = 6. Going out needs 6 cards meld-partitioned. Player would have to declare BEFORE discarding, hand=8.
    // Alternative: let player check if they can go out without discarding (hand=8, must partition into melds = unusual since 8 isn't 3+3+... wait 3+5 needs a 5-run; possible).
    // Simplification: "Go out" means player's CURRENT hand partitions into melds. Can be 6, 7, or 8 cards.
    if (!canPartition(hand)) return;
    const opponentIdx = 1 - p.turnIdx;
    const oppHand = hands[opponentIdx];
    const deadwood = oppHand.reduce((s, c) => s + deadwoodValue(c), 0);
    setPhase({ kind: "end", winnerIdx: p.turnIdx, deadwood });
  };

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>{current.name}&apos;s turn</span>
        <span>Stock: {stock.length}</span>
      </div>

      <div className="mt-4 flex justify-center gap-4">
        <button type="button" onClick={drawFromStock} disabled={p.drew || stock.length === 0} className="flex h-20 w-14 items-center justify-center rounded-md border border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))] disabled:opacity-40">
          Draw<br/>stock
        </button>
        <button type="button" onClick={drawFromDiscard} disabled={p.drew || !topDiscard} className="flex h-20 w-14 items-center justify-center rounded-md border border-border bg-[#f5efe4] font-display disabled:opacity-40">
          {topDiscard ? (
            <span className={topDiscard.suit === "♥" || topDiscard.suit === "♦" ? "text-[#a02a2a]" : "text-[#1a1008]"}>
              <span className="text-lg italic">{topDiscard.rank}</span><br/>
              <span className="text-lg">{topDiscard.suit}</span>
            </span>
          ) : <span className="text-muted text-xs">empty</span>}
        </button>
      </div>
      <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {p.drew ? "Discard one or go out." : "Draw one."}
      </p>

      <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Your hand ({hand.length})</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sortedHand.map((c) => {
          const red = c.suit === "♥" || c.suit === "♦";
          return (
            <button key={cardKey(c)} type="button" onClick={() => discardCard(c)} disabled={!p.drew} className={`flex h-16 w-11 flex-col items-center justify-center rounded-md border border-border bg-[#f5efe4] font-display ${red ? "text-[#a02a2a]" : "text-[#1a1008]"} ${p.drew ? "hover:bg-[#ffeecc]" : "opacity-80"}`}>
              <span className="text-lg italic">{c.rank}</span>
              <span className="text-lg">{c.suit}</span>
            </button>
          );
        })}
      </div>

      <button type="button" onClick={goOut} disabled={!canPartition(hand)} className="mt-4 w-full rounded-md border border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] py-3 font-mono text-[11px] uppercase tracking-wider text-[hsl(var(--ember))] transition-colors hover:bg-[hsl(var(--ember)/0.2)] disabled:opacity-40">
        Go out (full melds)
      </button>
      <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
    </section>
  );
};

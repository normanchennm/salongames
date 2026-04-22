"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Hearts — 4 players, single-hand pass-and-play.
 *
 *  No card passing phase. 2♣ leads first. Must follow suit. No hearts
 *  or Q♠ on the first trick. Hearts can only lead once "broken".
 *  Scoring: each ♥ = 1, Q♠ = 13. Shooting the moon (all 26) flips:
 *  you get 0, others get 26 each. Low score wins the hand.
 *
 *  This build ships one hand only; reaching 100 is deferred. */

const SUITS = ["♣", "♦", "♠", "♥"] as const;
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"] as const;
const RANK_VAL: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

type Suit = typeof SUITS[number];
type Rank = typeof RANKS[number];
interface Card { rank: Rank; suit: Suit; }

function deckShuffled(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardKey(c: Card): string { return c.rank + c.suit; }
function cardPoints(c: Card): number {
  if (c.suit === "♥") return 1;
  if (c.suit === "♠" && c.rank === "Q") return 13;
  return 0;
}

interface Trick { leadSuit: Suit; plays: { playerId: string; card: Card }[]; leaderIdx: number; }

type Phase =
  | { kind: "deal" }
  | { kind: "pass"; playerIdx: number }
  | { kind: "play-pass"; trickNo: number; trick: Trick; currentIdx: number }
  | { kind: "play"; trickNo: number; trick: Trick; currentIdx: number }
  | { kind: "trick-end"; winningIdx: number; points: number; trickNo: number }
  | { kind: "end"; scores: number[] };

export const HeartsBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [hands, setHands] = useState<Card[][]>(() => {
    const d = deckShuffled();
    return [d.slice(0, 13), d.slice(13, 26), d.slice(26, 39), d.slice(39, 52)];
  });
  const [scores, setScores] = useState<number[]>([0, 0, 0, 0]);
  const [heartsBroken, setHeartsBroken] = useState(false);
  // Find starting player (has 2 of clubs).
  const initialLeader = useMemo(() => {
    for (let i = 0; i < 4; i++) {
      if (hands[i].some((c) => c.rank === "2" && c.suit === "♣")) return i;
    }
    return 0;
  }, [hands]);
  const [phase, setPhase] = useState<Phase>(() => ({ kind: "pass", playerIdx: initialLeader }));
  useScrollToTop(phase.kind + ("playerIdx" in phase ? `-${phase.playerIdx}` : "") + ("currentIdx" in phase ? `-${phase.currentIdx}` : "") + ("trickNo" in phase ? `-t${phase.trickNo}` : ""));

  if (players.length !== 4) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">4-player only</p>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "end") {
    // Shoot the moon check: if any player scored 26, they get 0 and others +26.
    const raw = phase.scores.slice();
    const moonIdx = raw.findIndex((s) => s === 26);
    const final = moonIdx >= 0 ? raw.map((_, i) => i === moonIdx ? 0 : 26) : raw;
    const minScore = Math.min(...final);
    const winnerIdx = final.indexOf(minScore);
    const winner = players[winnerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">End of hand</p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{winner.name} wins.</h2>
        {moonIdx >= 0 && <p className="mt-2 text-sm text-[hsl(var(--ember))]">🌙 {players[moonIdx].name} shot the moon.</p>}
        <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
          <ul className="space-y-1 font-mono text-xs">
            {players.map((p, i) => (
              <li key={p.id} className={`flex justify-between ${i === winnerIdx ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
                <span>{p.name}</span>
                <span>{final[i]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 flex gap-3">
          <button type="button" onClick={() => onComplete({
            playedAt: new Date().toISOString(),
            players,
            winnerIds: [winner.id],
            durationSec: Math.round((Date.now() - startedAt) / 1000),
            highlights: moonIdx >= 0 ? ["Moon shot"] : [`${winner.name} ${minScore} pts`],
          })} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">Play again</button>
          <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
        </div>
      </section>
    );
  }

  // First trick: find 2♣ holder and open.
  if (phase.kind === "pass") {
    const p = players[phase.playerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Pass the phone</p>
        <h2 className="mt-6 font-display text-4xl italic">{p.name}, take the phone.</h2>
        <button type="button" onClick={() => {
          // If first trick (trickNo 0), force lead with 2♣.
          setPhase({ kind: "play", trickNo: 0, trick: { leadSuit: "♣", plays: [], leaderIdx: initialLeader }, currentIdx: initialLeader });
        }} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Start — {players[initialLeader].name} leads with 2♣ →
        </button>
      </section>
    );
  }

  if (phase.kind === "play-pass") {
    const current = players[phase.currentIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Trick {phase.trickNo + 1} / 13 · play {phase.trick.plays.length + 1} / 4
        </p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {current.name}.</h2>
        <p className="mt-3 text-sm text-muted">Private — only {current.name} should see your hand.</p>
        <button type="button" onClick={() => setPhase({ kind: "play", trickNo: phase.trickNo, trick: phase.trick, currentIdx: phase.currentIdx })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          I&apos;m {current.name} — show my hand →
        </button>
      </section>
    );
  }

  if (phase.kind === "play") {
    const p = phase;
    const current = players[p.currentIdx];
    const hand = hands[p.currentIdx];
    const isLeader = p.trick.plays.length === 0;
    const firstTrick = p.trickNo === 0;
    const hasLedSuit = !isLeader && hand.some((c) => c.suit === p.trick.leadSuit);

    const isPlayable = (c: Card): boolean => {
      if (isLeader) {
        if (firstTrick) return c.rank === "2" && c.suit === "♣";
        if (c.suit === "♥" && !heartsBroken && hand.some((x) => x.suit !== "♥")) return false;
        return true;
      }
      // Following.
      if (hasLedSuit) return c.suit === p.trick.leadSuit;
      // Off-suit on first trick: no hearts or Q♠.
      if (firstTrick && (c.suit === "♥" || (c.suit === "♠" && c.rank === "Q"))) return false;
      return true;
    };

    const play = (card: Card) => {
      if (!isPlayable(card)) return;
      const nextHands = hands.map((h, i) => i === p.currentIdx ? h.filter((x) => cardKey(x) !== cardKey(card)) : h);
      setHands(nextHands);
      if (card.suit === "♥" && !heartsBroken) setHeartsBroken(true);
      const newPlays = [...p.trick.plays, { playerId: current.id, card }];
      const newTrick: Trick = {
        leadSuit: isLeader ? card.suit : p.trick.leadSuit,
        plays: newPlays,
        leaderIdx: p.trick.leaderIdx,
      };
      if (newPlays.length === 4) {
        // Resolve trick.
        const winningPlay = newPlays
          .filter((pl) => pl.card.suit === newTrick.leadSuit)
          .reduce((best, cur) => RANK_VAL[cur.card.rank] > RANK_VAL[best.card.rank] ? cur : best);
        const winIdx = players.findIndex((pl) => pl.id === winningPlay.playerId);
        const points = newPlays.reduce((sum, pl) => sum + cardPoints(pl.card), 0);
        const nextScores = scores.slice();
        nextScores[winIdx] += points;
        setScores(nextScores);
        setPhase({ kind: "trick-end", winningIdx: winIdx, points, trickNo: p.trickNo });
      } else {
        setPhase({ kind: "play-pass", trickNo: p.trickNo, trick: newTrick, currentIdx: (p.currentIdx + 1) % 4 });
      }
    };

    const sortedHand = hand.slice().sort((a, b) => {
      const si = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return RANK_VAL[a.rank] - RANK_VAL[b.rank];
    });

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{current.name}&apos;s turn · trick {p.trickNo + 1} / 13</span>
          <span>{heartsBroken ? "♥ broken" : ""}</span>
        </div>
        <div className="mt-3 rounded-md border border-border bg-bg/40 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">This trick</p>
          <div className="mt-1 flex gap-2 flex-wrap">
            {p.trick.plays.map((pl, i) => (
              <span key={i} className={`rounded-md border border-[hsl(var(--ember)/0.4)] px-2 py-1 font-mono text-xs ${pl.card.suit === "♥" || pl.card.suit === "♦" ? "text-[#a02a2a]" : "text-fg"}`}>
                {pl.card.rank}{pl.card.suit} <span className="text-muted">({players.find((pp) => pp.id === pl.playerId)?.name})</span>
              </span>
            ))}
            {p.trick.plays.length === 0 && <span className="text-xs text-muted">(lead)</span>}
          </div>
        </div>

        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Your hand</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sortedHand.map((c) => {
            const playable = isPlayable(c);
            const red = c.suit === "♥" || c.suit === "♦";
            return (
              <button
                key={cardKey(c)}
                type="button"
                onClick={() => play(c)}
                disabled={!playable}
                className={`flex h-14 w-10 flex-col items-center justify-center rounded-md border bg-[#f5efe4] font-display ${red ? "text-[#a02a2a]" : "text-[#1a1008]"} ${
                  playable ? "border-[hsl(var(--ember))] hover:bg-[#ffeecc]" : "border-border/40 opacity-40"
                }`}
              >
                <span className="text-lg italic">{c.rank}</span>
                <span className="text-lg">{c.suit}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {isLeader ? (firstTrick ? "Lead 2♣." : "Lead any (hearts need breaking first).") : hasLedSuit ? `Follow ${p.trick.leadSuit}.` : `Off-suit allowed${firstTrick ? " (no ♥, no Q♠)" : ""}.`}
        </p>
      </section>
    );
  }

  if (phase.kind === "trick-end") {
    const winner = players[phase.winningIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Trick {phase.trickNo + 1} taken by</p>
        <h2 className="mt-2 font-display text-3xl italic text-[hsl(var(--ember))]">{winner.name}</h2>
        <p className="mt-1 text-sm text-muted">+{phase.points} points</p>
        <div className="mt-6 rounded-md border border-border bg-bg/40 p-3">
          <ul className="space-y-0.5 font-mono text-xs">
            {players.map((p, i) => (
              <li key={p.id} className="flex justify-between">
                <span className="text-fg">{p.name}</span>
                <span className="text-muted">{scores[i]}</span>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={() => {
          const nextTrickNo = phase.trickNo + 1;
          if (nextTrickNo >= 13) {
            setPhase({ kind: "end", scores });
          } else {
            setPhase({ kind: "play-pass", trickNo: nextTrickNo, trick: { leadSuit: "♣", plays: [], leaderIdx: phase.winningIdx }, currentIdx: phase.winningIdx });
          }
        }} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          {phase.trickNo + 1 >= 13 ? "See result →" : `${winner.name} leads next →`}
        </button>
      </section>
    );
  }

  return null;
};

"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** War — the simplest card game in existence. 52-card deck split in
 *  half. Each round, both players flip their top card. Higher card
 *  takes both. Tie = "war": each drops 3 face-down and 1 face-up;
 *  higher face-up takes everything. First to hold all 52 wins.
 *
 *  Games can run forever in pathological cycles, so we cap at 200
 *  rounds and award on card count if the cap is hit. */

const MAX_ROUNDS = 200;
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RANK_VALUE: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

interface Card { rank: string; suit: string; }

function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function CardFace({ card }: { card: Card }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div className={`flex h-24 w-16 flex-col items-center justify-center rounded-md border border-border bg-[#f5efe4] p-2 ${red ? "text-[#a02a2a]" : "text-[#1a1008]"}`}>
      <span className="font-display text-2xl italic">{card.rank}</span>
      <span className="text-xl">{card.suit}</span>
    </div>
  );
}
function CardBack() {
  return <div className="h-24 w-16 rounded-md border border-[hsl(var(--ember)/0.3)] bg-[hsl(var(--ember)/0.15)]" />;
}

type Phase =
  | { kind: "ready"; p1: Card[]; p2: Card[]; round: number; lastWinner: "p1" | "p2" | "war" | null; lastP1: Card | null; lastP2: Card | null }
  | { kind: "war"; p1: Card[]; p2: Card[]; stake: Card[]; round: number }
  | { kind: "end"; winnerIdx: 0 | 1 | "draw"; p1Count: number; p2Count: number };

export const WarBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>(() => {
    const deck = newDeck();
    return { kind: "ready", p1: deck.slice(0, 26), p2: deck.slice(26), round: 0, lastWinner: null, lastP1: null, lastP2: null };
  });
  useScrollToTop(phase.kind + ("round" in phase ? `-${phase.round}` : ""));

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <h2 className="mt-2 font-display text-2xl italic">Pick exactly two.</h2>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "end") {
    const name = phase.winnerIdx === "draw" ? "Draw" : `${players[phase.winnerIdx].name} wins.`;
    const winnerIds = phase.winnerIdx === "draw" ? players.map((p) => p.id) : [players[phase.winnerIdx].id];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Result</p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{name}</h2>
        <p className="mt-2 text-sm text-muted">Cards: {players[0].name} {phase.p1Count} · {players[1].name} {phase.p2Count}</p>
        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={() =>
              onComplete({
                playedAt: new Date().toISOString(),
                players,
                winnerIds,
                durationSec: Math.round((Date.now() - startedAt) / 1000),
                highlights: [`Final: ${phase.p1Count} vs ${phase.p2Count}`],
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

  if (phase.kind === "ready") {
    const playRound = () => {
      if (phase.round >= MAX_ROUNDS) {
        setPhase({ kind: "end", winnerIdx: phase.p1.length > phase.p2.length ? 0 : phase.p2.length > phase.p1.length ? 1 : "draw", p1Count: phase.p1.length, p2Count: phase.p2.length });
        return;
      }
      if (phase.p1.length === 0) {
        setPhase({ kind: "end", winnerIdx: 1, p1Count: 0, p2Count: phase.p2.length });
        return;
      }
      if (phase.p2.length === 0) {
        setPhase({ kind: "end", winnerIdx: 0, p1Count: phase.p1.length, p2Count: 0 });
        return;
      }
      const [c1, ...r1] = phase.p1;
      const [c2, ...r2] = phase.p2;
      if (RANK_VALUE[c1.rank] > RANK_VALUE[c2.rank]) {
        setPhase({ kind: "ready", p1: [...r1, c1, c2], p2: r2, round: phase.round + 1, lastWinner: "p1", lastP1: c1, lastP2: c2 });
      } else if (RANK_VALUE[c2.rank] > RANK_VALUE[c1.rank]) {
        setPhase({ kind: "ready", p1: r1, p2: [...r2, c1, c2], round: phase.round + 1, lastWinner: "p2", lastP1: c1, lastP2: c2 });
      } else {
        // War: each puts 3 face-down + 1 face-up from their deck; compare face-ups.
        setPhase({ kind: "war", p1: r1, p2: r2, stake: [c1, c2], round: phase.round + 1 });
      }
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>Round {phase.round + 1}</span>
          <span>{players[0].name} {phase.p1.length} · {players[1].name} {phase.p2.length}</span>
        </div>
        <div className="mt-6 flex items-center justify-around">
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{players[0].name}</p>
            <div className="mt-2">{phase.lastP1 ? <CardFace card={phase.lastP1} /> : <CardBack />}</div>
          </div>
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{players[1].name}</p>
            <div className="mt-2">{phase.lastP2 ? <CardFace card={phase.lastP2} /> : <CardBack />}</div>
          </div>
        </div>
        {phase.lastWinner && phase.lastWinner !== "war" && (
          <p className="mt-4 text-center font-display text-lg italic text-[hsl(var(--ember))]">
            {phase.lastWinner === "p1" ? players[0].name : players[1].name} takes both.
          </p>
        )}
        <button
          type="button"
          onClick={playRound}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Flip →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // WAR
  const p = phase;
  const resolveWar = () => {
    // Need at least 4 cards each (3 face-down + 1 face-up). If a player runs out, they lose.
    if (p.p1.length < 4 || p.p2.length < 4) {
      // The player with fewer cards loses.
      const winnerIdx: 0 | 1 = p.p1.length < p.p2.length ? 1 : 0;
      setPhase({ kind: "end", winnerIdx, p1Count: p.p1.length, p2Count: p.p2.length });
      return;
    }
    const p1Stake = p.p1.slice(0, 4);
    const p2Stake = p.p2.slice(0, 4);
    const r1 = p.p1.slice(4);
    const r2 = p.p2.slice(4);
    const face1 = p1Stake[3];
    const face2 = p2Stake[3];
    const allStake = [...p.stake, ...p1Stake, ...p2Stake];
    if (RANK_VALUE[face1.rank] > RANK_VALUE[face2.rank]) {
      setPhase({ kind: "ready", p1: [...r1, ...allStake], p2: r2, round: p.round, lastWinner: "p1", lastP1: face1, lastP2: face2 });
    } else if (RANK_VALUE[face2.rank] > RANK_VALUE[face1.rank]) {
      setPhase({ kind: "ready", p1: r1, p2: [...r2, ...allStake], round: p.round, lastWinner: "p2", lastP1: face1, lastP2: face2 });
    } else {
      // Nested war.
      setPhase({ kind: "war", p1: r1, p2: r2, stake: allStake, round: p.round });
    }
  };
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">WAR</p>
      <h2 className="mt-2 font-display text-3xl italic">Same rank. Three face-down, one face-up.</h2>
      <p className="mt-3 text-sm text-muted">Pot: {p.stake.length} cards at stake.</p>
      <button type="button" onClick={resolveWar} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
        Flip the face-ups →
      </button>
    </section>
  );
};

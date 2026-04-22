"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Spades — 4 players in partnerships (0+2 vs 1+3), single-hand build.
 *
 *  Deal 13 cards each. Bid 0-13 tricks. Play: follow led suit if
 *  possible; spades trump; spades can't lead until broken. Scoring
 *  per partnership at hand end: if total partnership tricks >= total
 *  partnership bid → +10 per bid + 1 per overtrick; else -10 per bid.
 *
 *  Nil bid + matching-to-500 + bags penalty are deferred. */

const SUITS = ["♣", "♦", "♥", "♠"] as const;
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

interface Trick { leadSuit: Suit; plays: { playerIdx: number; card: Card }[]; }

type Phase =
  | { kind: "intro" }
  | { kind: "bid-pass"; bidderIdx: number }
  | { kind: "bid-input"; bidderIdx: number }
  | { kind: "play-pass"; trickNo: number; trick: Trick; currentIdx: number; takes: number[] }
  | { kind: "play-card"; trickNo: number; trick: Trick; currentIdx: number; takes: number[] }
  | { kind: "trick-end"; winningIdx: number; trickNo: number; takes: number[] }
  | { kind: "end"; takes: number[] };

export const SpadesBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [hands, setHands] = useState<Card[][]>(() => {
    const d = deckShuffled();
    return [d.slice(0, 13), d.slice(13, 26), d.slice(26, 39), d.slice(39, 52)];
  });
  const [bids, setBids] = useState<number[]>([0, 0, 0, 0]);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [spadesBroken, setSpadesBroken] = useState(false);
  useScrollToTop(phase.kind + ("bidderIdx" in phase ? `-${phase.bidderIdx}` : "") + ("currentIdx" in phase ? `-${phase.currentIdx}` : "") + ("trickNo" in phase ? `-${phase.trickNo}` : ""));

  if (players.length !== 4) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">4-player only</p>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Partnerships</p>
        <h2 className="mt-2 font-display text-3xl italic">{players[0].name} + {players[2].name} vs {players[1].name} + {players[3].name}</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">Bid privately. Play out 13 tricks. Make your partnership bid for points.</p>
        <button type="button" onClick={() => setPhase({ kind: "bid-pass", bidderIdx: 0 })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Start bidding →
        </button>
      </section>
    );
  }

  if (phase.kind === "bid-pass") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Bid {phase.bidderIdx + 1} / 4</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {players[phase.bidderIdx].name}.</h2>
        <button type="button" onClick={() => setPhase({ kind: "bid-input", bidderIdx: phase.bidderIdx })} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          I&apos;m {players[phase.bidderIdx].name} — show hand →
        </button>
      </section>
    );
  }

  if (phase.kind === "bid-input") {
    const p = phase;
    const hand = hands[p.bidderIdx].slice().sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANK_VAL[a.rank] - RANK_VAL[b.rank]);
    const placeBid = (n: number) => {
      const nextBids = [...bids];
      nextBids[p.bidderIdx] = n;
      setBids(nextBids);
      const nextIdx = p.bidderIdx + 1;
      if (nextIdx >= 4) {
        setPhase({ kind: "play-pass", trickNo: 0, trick: { leadSuit: "♣", plays: [] }, currentIdx: 0, takes: [0, 0, 0, 0] });
      } else {
        setPhase({ kind: "bid-pass", bidderIdx: nextIdx });
      }
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{players[p.bidderIdx].name} — bid 0-13</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hand.map((c) => {
            const red = c.suit === "♥" || c.suit === "♦";
            return (
              <div key={cardKey(c)} className={`flex h-14 w-10 flex-col items-center justify-center rounded-md border border-border bg-[#f5efe4] font-display ${red ? "text-[#a02a2a]" : "text-[#1a1008]"}`}>
                <span className="text-lg italic">{c.rank}</span>
                <span className="text-lg">{c.suit}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-5 grid grid-cols-7 gap-2">
          {Array.from({ length: 14 }, (_, n) => (
            <button key={n} type="button" onClick={() => placeBid(n)} className="rounded-md border border-border bg-bg/40 py-3 font-mono text-sm hover:border-[hsl(var(--ember)/0.6)]">
              {n}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (phase.kind === "play-pass") {
    const current = players[phase.currentIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Trick {phase.trickNo + 1} / 13</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {current.name}.</h2>
        <button type="button" onClick={() => setPhase({ ...phase, kind: "play-card" })} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          I&apos;m {current.name} — play card →
        </button>
      </section>
    );
  }

  if (phase.kind === "play-card") {
    const p = phase;
    const current = players[p.currentIdx];
    const hand = hands[p.currentIdx];
    const isLeader = p.trick.plays.length === 0;
    const hasLedSuit = !isLeader && hand.some((c) => c.suit === p.trick.leadSuit);

    const isPlayable = (c: Card): boolean => {
      if (isLeader) {
        if (c.suit === "♠" && !spadesBroken && hand.some((x) => x.suit !== "♠")) return false;
        return true;
      }
      if (hasLedSuit) return c.suit === p.trick.leadSuit;
      return true;
    };

    const play = (card: Card) => {
      if (!isPlayable(card)) return;
      const nextHands = hands.map((h, i) => i === p.currentIdx ? h.filter((x) => cardKey(x) !== cardKey(card)) : h);
      setHands(nextHands);
      if (card.suit === "♠" && !spadesBroken) setSpadesBroken(true);
      const newPlays = [...p.trick.plays, { playerIdx: p.currentIdx, card }];
      const leadSuit = isLeader ? card.suit : p.trick.leadSuit;
      if (newPlays.length === 4) {
        const spadePlays = newPlays.filter((pl) => pl.card.suit === "♠");
        const winningPlay = spadePlays.length > 0
          ? spadePlays.reduce((b, c) => RANK_VAL[c.card.rank] > RANK_VAL[b.card.rank] ? c : b)
          : newPlays.filter((pl) => pl.card.suit === leadSuit).reduce((b, c) => RANK_VAL[c.card.rank] > RANK_VAL[b.card.rank] ? c : b);
        const winIdx = winningPlay.playerIdx;
        const nextTakes = p.takes.slice();
        nextTakes[winIdx]++;
        setPhase({ kind: "trick-end", winningIdx: winIdx, trickNo: p.trickNo, takes: nextTakes });
      } else {
        setPhase({ kind: "play-pass", trickNo: p.trickNo, trick: { leadSuit, plays: newPlays }, currentIdx: (p.currentIdx + 1) % 4, takes: p.takes });
      }
    };

    const sortedHand = hand.slice().sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANK_VAL[a.rank] - RANK_VAL[b.rank]);

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{current.name}&apos;s turn · trick {p.trickNo + 1}</span>
          <span>{spadesBroken ? "♠ broken" : ""}</span>
        </div>
        <div className="mt-3 rounded-md border border-border bg-bg/40 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">This trick</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {p.trick.plays.map((pl, i) => (
              <span key={i} className={`rounded-md border border-[hsl(var(--ember)/0.4)] px-2 py-1 font-mono text-xs ${pl.card.suit === "♥" || pl.card.suit === "♦" ? "text-[#a02a2a]" : "text-fg"}`}>
                {pl.card.rank}{pl.card.suit} <span className="text-muted">({players[pl.playerIdx].name})</span>
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
              <button key={cardKey(c)} type="button" onClick={() => play(c)} disabled={!playable} className={`flex h-14 w-10 flex-col items-center justify-center rounded-md border bg-[#f5efe4] font-display ${red ? "text-[#a02a2a]" : "text-[#1a1008]"} ${playable ? "border-[hsl(var(--ember))] hover:bg-[#ffeecc]" : "border-border/40 opacity-40"}`}>
                <span className="text-lg italic">{c.rank}</span>
                <span className="text-lg">{c.suit}</span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (phase.kind === "trick-end") {
    const winner = players[phase.winningIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Trick {phase.trickNo + 1}</p>
        <h2 className="mt-2 font-display text-3xl italic text-[hsl(var(--ember))]">{winner.name} takes it.</h2>
        <p className="mt-1 text-sm text-muted">Tricks taken: {phase.takes.join(" / ")}</p>
        <button type="button" onClick={() => {
          const nextTrickNo = phase.trickNo + 1;
          if (nextTrickNo >= 13) setPhase({ kind: "end", takes: phase.takes });
          else setPhase({ kind: "play-pass", trickNo: nextTrickNo, trick: { leadSuit: "♣", plays: [] }, currentIdx: phase.winningIdx, takes: phase.takes });
        }} className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          {phase.trickNo + 1 >= 13 ? "See result →" : `${winner.name} leads next →`}
        </button>
      </section>
    );
  }

  // END
  const t1Bid = bids[0] + bids[2];
  const t2Bid = bids[1] + bids[3];
  const t1Takes = phase.takes[0] + phase.takes[2];
  const t2Takes = phase.takes[1] + phase.takes[3];
  const t1Score = t1Takes >= t1Bid ? t1Bid * 10 + (t1Takes - t1Bid) : -t1Bid * 10;
  const t2Score = t2Takes >= t2Bid ? t2Bid * 10 + (t2Takes - t2Bid) : -t2Bid * 10;
  const team1Wins = t1Score > t2Score;
  const tie = t1Score === t2Score;
  const winnerIds = tie ? players.map((p) => p.id) : team1Wins ? [players[0].id, players[2].id] : [players[1].id, players[3].id];

  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">End of hand</p>
      <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">
        {tie ? "Draw." : team1Wins ? `${players[0].name} + ${players[2].name} win.` : `${players[1].name} + ${players[3].name} win.`}
      </h2>
      <div className="mt-6 rounded-md border border-border bg-bg/40 p-4 text-left">
        <div className="flex justify-between text-sm"><span className="text-[hsl(var(--ember))]">{players[0].name} + {players[2].name}</span><span>{t1Score}</span></div>
        <div className="text-xs text-muted">bid {t1Bid} · took {t1Takes}</div>
        <div className="mt-3 flex justify-between text-sm"><span className="text-fg">{players[1].name} + {players[3].name}</span><span>{t2Score}</span></div>
        <div className="text-xs text-muted">bid {t2Bid} · took {t2Takes}</div>
      </div>
      <div className="mt-10 flex gap-3">
        <button type="button" onClick={() => onComplete({
          playedAt: new Date().toISOString(),
          players,
          winnerIds,
          durationSec: Math.round((Date.now() - startedAt) / 1000),
          highlights: [`${t1Score} vs ${t2Score}`],
        })} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">Play again</button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </div>
    </section>
  );
};

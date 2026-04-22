"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, LIARSDICE_CUES } from "@/lib/narrator";

/** Liar's Dice — pass-and-play bluffing dice.
 *
 *  Each round: every player rolls their dice privately (5 to start),
 *  then takes turns either raising the bid ("N dice show face F") or
 *  calling the previous bidder a liar. On a call, all dice are revealed
 *  and counted. If the total matches or exceeds the bid, the caller
 *  loses a die; otherwise the bidder loses a die. Ones are wild.
 *
 *  A player with zero dice is out. Last player with dice wins. */

const STARTING_DICE = 5;
const WILD_FACE = 1;

interface Bid { quantity: number; face: number; bidderId: string; }
interface DiceBag { playerId: string; dice: number[]; }

type Phase =
  | { kind: "round-intro"; round: number; bags: DiceBag[]; currentIdx: number }
  | { kind: "reveal-pass"; round: number; bags: DiceBag[]; currentIdx: number; revealIdx: number }
  | { kind: "reveal-dice"; round: number; bags: DiceBag[]; currentIdx: number; revealIdx: number }
  | { kind: "bidding"; round: number; bags: DiceBag[]; currentIdx: number; bid: Bid | null; draft: { quantity: number; face: number } }
  | { kind: "reveal-all"; round: number; bags: DiceBag[]; bid: Bid; callerId: string; total: number; loserId: string }
  | { kind: "end"; winnerId: string };

function rollDice(n: number): number[] {
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
}

function countFace(bags: DiceBag[], face: number): number {
  let total = 0;
  for (const bag of bags) {
    for (const d of bag.dice) {
      if (d === face || (d === WILD_FACE && face !== WILD_FACE)) total++;
    }
  }
  return total;
}

function nextAlive(bags: DiceBag[], startIdx: number): number {
  const n = bags.length;
  for (let k = 1; k <= n; k++) {
    const idx = (startIdx + k) % n;
    if (bags[idx].dice.length > 0) return idx;
  }
  return startIdx;
}

function DiceRow({ dice, muted }: { dice: number[]; muted?: boolean }) {
  const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  return (
    <div className={`flex gap-1.5 ${muted ? "opacity-60" : ""}`}>
      {dice.map((d, i) => (
        <div key={i} className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-bg/60 text-2xl text-fg">
          {faces[d - 1]}
        </div>
      ))}
    </div>
  );
}

export const LiarsDiceBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>(() => {
    const bags = players.map((p) => ({ playerId: p.id, dice: rollDice(STARTING_DICE) }));
    return { kind: "round-intro", round: 0, bags, currentIdx: 0 };
  });
  useScrollToTop(phase.kind + ("round" in phase ? `-${phase.round}` : "") + ("revealIdx" in phase ? `-${phase.revealIdx}` : ""));

  useEffect(() => {
    if (phase.kind === "reveal-all") {
      playCue(LIARSDICE_CUES.callLiar);
      const holds = phase.total >= phase.bid.quantity;
      setTimeout(() => playCue(holds ? LIARSDICE_CUES.bidHolds : LIARSDICE_CUES.bluffCaught), 2500);
    } else if (phase.kind === "end") {
      playCue(LIARSDICE_CUES.winner);
    }
  }, [phase]);

  function finish(winnerId: string) {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: [winnerId],
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${players.find((p) => p.id === winnerId)?.name ?? "?"} last dice standing`],
    });
  }

  // --- ROUND INTRO ---------------------------------------------
  if (phase.kind === "round-intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Round {phase.round + 1}</p>
        <h2 className="mt-2 font-display text-3xl italic">Fresh rolls, fresh bids.</h2>
        <p className="mt-3 text-sm text-muted">
          Everyone privately sees their dice. Then the first bidder opens with a bid like &ldquo;four 3s&rdquo;. Ones are wild.
        </p>
        <div className="mt-6 rounded-md border border-border bg-bg/40 p-4 text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Dice remaining</p>
          <ul className="mt-2 space-y-1">
            {phase.bags.map((b) => {
              const p = players.find((pl) => pl.id === b.playerId);
              return (
                <li key={b.playerId} className="flex items-baseline justify-between">
                  <span className={`font-display italic ${b.dice.length === 0 ? "text-muted/50 line-through" : "text-fg"}`}>
                    {p?.name}
                  </span>
                  <span className="font-mono text-sm text-muted">{b.dice.length}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setPhase({ kind: "reveal-pass", round: phase.round, bags: phase.bags, currentIdx: phase.currentIdx, revealIdx: 0 })}
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Start reveals →
        </button>
      </section>
    );
  }

  // --- REVEAL PASS (per-player dice, private) ------------------
  if (phase.kind === "reveal-pass") {
    // Skip eliminated.
    let idx = phase.revealIdx;
    while (idx < phase.bags.length && phase.bags[idx].dice.length === 0) idx++;
    if (idx !== phase.revealIdx) {
      setTimeout(() => setPhase({ ...phase, revealIdx: idx }), 0);
    }
    if (idx >= phase.bags.length) {
      // All revealed → bidding.
      setTimeout(() => setPhase({ kind: "bidding", round: phase.round, bags: phase.bags, currentIdx: phase.currentIdx, bid: null, draft: { quantity: 1, face: 2 } }), 0);
      return null;
    }
    const p = players[idx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Reveal {phase.revealIdx + 1} / {phase.bags.length}
        </p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {p.name}.</h2>
        <p className="mt-4 text-sm text-muted">Only {p.name} should see your dice.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "reveal-dice", round: phase.round, bags: phase.bags, currentIdx: phase.currentIdx, revealIdx: phase.revealIdx })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {p.name} — reveal →
        </button>
      </section>
    );
  }

  // --- REVEAL DICE ---------------------------------------------
  if (phase.kind === "reveal-dice") {
    const bag = phase.bags[phase.revealIdx];
    const p = players[phase.revealIdx];
    const nextIdx = phase.revealIdx + 1;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{p.name}, your dice</p>
        <div className="mt-6 flex justify-center">
          <DiceRow dice={bag.dice} />
        </div>
        <button
          type="button"
          onClick={() => setPhase({ kind: "reveal-pass", round: phase.round, bags: phase.bags, currentIdx: phase.currentIdx, revealIdx: nextIdx })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Hide & pass →
        </button>
      </section>
    );
  }

  // --- BIDDING -------------------------------------------------
  if (phase.kind === "bidding") {
    const p = phase;
    const current = players[p.currentIdx];
    const totalDice = p.bags.reduce((sum, b) => sum + b.dice.length, 0);

    const isLegalRaise = (q: number, f: number): boolean => {
      if (!p.bid) return q >= 1 && f >= 2 && f <= 6;
      if (q > p.bid.quantity) return f >= 2 && f <= 6;
      if (q === p.bid.quantity) return f > p.bid.face;
      return false;
    };

    const placeBid = () => {
      const { quantity, face } = p.draft;
      if (!isLegalRaise(quantity, face)) return;
      const bid: Bid = { quantity, face, bidderId: current.id };
      const next = nextAlive(p.bags, p.currentIdx);
      setPhase({ kind: "bidding", round: p.round, bags: p.bags, currentIdx: next, bid, draft: { quantity, face } });
    };

    const callLiar = () => {
      if (!p.bid) return;
      const total = countFace(p.bags, p.bid.face);
      const bidHolds = total >= p.bid.quantity;
      const loserId = bidHolds ? current.id : p.bid.bidderId;
      setPhase({ kind: "reveal-all", round: p.round, bags: p.bags, bid: p.bid, callerId: current.id, total, loserId });
    };

    const canRaise = isLegalRaise(p.draft.quantity, p.draft.face);

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{current.name}&apos;s turn</span>
          <span>Total dice: {totalDice}</span>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-bg/40 p-4 text-center">
          {p.bid ? (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Current bid</p>
              <p className="mt-1 font-display text-3xl italic text-[hsl(var(--ember))]">
                {p.bid.quantity} × {p.bid.face}s
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted">
                by {players.find((pl) => pl.id === p.bid!.bidderId)?.name}
              </p>
            </>
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Opening bid — set the floor.</p>
          )}
        </div>

        <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Your bid</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quantity</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPhase({ ...p, draft: { ...p.draft, quantity: Math.max(1, p.draft.quantity - 1) } })} className="rounded-md border border-border px-3 py-1 font-mono text-sm">−</button>
                <span className="flex-1 text-center font-display text-2xl italic text-fg">{p.draft.quantity}</span>
                <button type="button" onClick={() => setPhase({ ...p, draft: { ...p.draft, quantity: Math.min(totalDice, p.draft.quantity + 1) } })} className="rounded-md border border-border px-3 py-1 font-mono text-sm">+</button>
              </div>
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Face (2–6)</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPhase({ ...p, draft: { ...p.draft, face: Math.max(2, p.draft.face - 1) } })} className="rounded-md border border-border px-3 py-1 font-mono text-sm">−</button>
                <span className="flex-1 text-center font-display text-2xl italic text-fg">{p.draft.face}</span>
                <button type="button" onClick={() => setPhase({ ...p, draft: { ...p.draft, face: Math.min(6, p.draft.face + 1) } })} className="rounded-md border border-border px-3 py-1 font-mono text-sm">+</button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={callLiar}
            disabled={!p.bid}
            className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg disabled:opacity-40"
          >
            Call liar
          </button>
          <button
            type="button"
            onClick={placeBid}
            disabled={!canRaise}
            className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Raise
          </button>
        </div>

        <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Quit
        </button>
      </section>
    );
  }

  // --- REVEAL ALL (call result) --------------------------------
  if (phase.kind === "reveal-all") {
    const loser = players.find((p) => p.id === phase.loserId);
    const bidHolds = phase.total >= phase.bid.quantity;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Showdown</p>
        <h2 className="mt-2 font-display text-3xl italic">
          {phase.bid.quantity} × {phase.bid.face}s — actual: {phase.total}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {bidHolds ? "The bid holds. Caller loses a die." : "Too few. Bidder loses a die."}
        </p>
        <div className="mt-6 space-y-2">
          {phase.bags.map((b) => {
            const p = players.find((pl) => pl.id === b.playerId);
            return (
              <div key={b.playerId} className="rounded-md border border-border bg-bg/40 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-display italic text-fg">{p?.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{b.dice.length} dice</span>
                </div>
                <div className="mt-2"><DiceRow dice={b.dice} muted={b.dice.length === 0} /></div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            // Remove one die from loser; next round or end.
            const newBags = phase.bags.map((b) =>
              b.playerId === phase.loserId ? { ...b, dice: b.dice.slice(0, -1) } : b,
            );
            const alive = newBags.filter((b) => b.dice.length > 0);
            if (alive.length <= 1) {
              const winner = alive[0]?.playerId ?? phase.loserId;
              setPhase({ kind: "end", winnerId: winner });
              return;
            }
            // Reroll everyone's dice.
            const rerolled = newBags.map((b) => ({ ...b, dice: b.dice.length > 0 ? rollDice(b.dice.length) : [] }));
            // Loser (or next alive) opens next round; if loser was eliminated, start from next alive after them.
            const loserIdx = players.findIndex((p) => p.id === phase.loserId);
            const startIdx = rerolled[loserIdx]?.dice.length > 0 ? loserIdx : nextAlive(rerolled, loserIdx);
            setPhase({ kind: "round-intro", round: phase.round + 1, bags: rerolled, currentIdx: startIdx });
          }}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {loser ? `${loser.name} loses a die →` : "Next →"}
        </button>
      </section>
    );
  }

  // --- END -----------------------------------------------------
  const winner = players.find((p) => p.id === phase.winnerId);
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Last dice standing</p>
      <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{winner?.name} wins.</h2>
      <div className="mt-10 flex gap-3">
        <button type="button" onClick={() => finish(phase.winnerId)} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Play again
        </button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
          Back
        </button>
      </div>
    </section>
  );
};

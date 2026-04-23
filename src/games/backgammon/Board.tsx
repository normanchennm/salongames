"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { BackgammonRemoteBoard } from "./RemoteBoard";

/** Backgammon — simplified 2-player build.
 *
 *  24 points (numbered 1-24 from white's perspective, with white moving
 *  toward 1 and black moving toward 24 — mirrored). Each player has 15
 *  checkers in the standard starting arrangement. Turn: roll two dice
 *  (doubles = 4 moves), move by their pip values. Hit a single opponent
 *  to send them to the bar. All home-board checkers in? You may bear
 *  off. First to remove all 15 wins.
 *
 *  Deferred: doubling cube, match play, gammon/backgammon scoring,
 *  opening roll. Player 0 ("white") always starts here for simplicity. */

const POINTS = 24;
type Player = 0 | 1; // 0 = white, 1 = black

interface BoardState {
  // points[i] = stack of checkers on point i+1 (i in 0..23). Positive = white count, negative = black count.
  points: number[];
  barW: number;
  barB: number;
  offW: number;
  offB: number;
}

function startState(): BoardState {
  const points = Array<number>(POINTS).fill(0);
  // White perspective starting setup: points are 1..24, white moves 24 → 1.
  // Standard: W at 24 (2), 13 (5), 8 (3), 6 (5). B at 1 (2), 12 (5), 17 (3), 19 (5).
  points[23] = 2;   // W on 24
  points[12] = 5;   // W on 13
  points[7] = 3;    // W on 8
  points[5] = 5;    // W on 6
  points[0] = -2;   // B on 1
  points[11] = -5;  // B on 12
  points[16] = -3;  // B on 17
  points[18] = -5;  // B on 19
  return { points, barW: 0, barB: 0, offW: 0, offB: 0 };
}

function rollPair(): number[] {
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  return a === b ? [a, a, a, a] : [a, b];
}

function allInHome(board: BoardState, who: Player): boolean {
  if (who === 0) {
    // White home is points 1-6 (index 0-5).
    for (let i = 6; i < POINTS; i++) if (board.points[i] > 0) return false;
    return board.barW === 0;
  } else {
    for (let i = 0; i < 18; i++) if (board.points[i] < 0) return false;
    return board.barB === 0;
  }
}

function canMove(board: BoardState, who: Player, from: number | "bar", die: number): boolean {
  if (who === 0) {
    // White moves: from higher index to lower. "bar" enters on points 19-24 (indices 18-23).
    if (from === "bar") {
      if (board.barW === 0) return false;
      const target = 24 - die; // e.g., die 6 enters on point 19 (index 18)
      if (target < 0) return false;
      const cell = board.points[target];
      return cell >= -1; // empty, own stack, or single black blot
    }
    if (board.barW > 0) return false; // must re-enter first
    const target = (from as number) - die;
    if (target < 0) {
      // bear off
      if (!allInHome(board, 0)) return false;
      // Exact match or highest occupied < from
      if (target === -1) return true; // exact bear off from point "die" which equals from+1? rethink
      // If die > from+1, allowed only if no higher white checker exists in home.
      for (let i = (from as number) + 1; i <= 5; i++) if (board.points[i] > 0) return false;
      return true;
    }
    const cell = board.points[target];
    return cell >= -1;
  } else {
    if (from === "bar") {
      if (board.barB === 0) return false;
      const target = die - 1; // die 1 enters point 1 (index 0)
      if (target >= POINTS) return false;
      const cell = board.points[target];
      return cell <= 1;
    }
    if (board.barB > 0) return false;
    const target = (from as number) + die;
    if (target >= POINTS) {
      if (!allInHome(board, 1)) return false;
      for (let i = (from as number) - 1; i >= 18; i--) if (board.points[i] < 0) return false;
      return true;
    }
    const cell = board.points[target];
    return cell <= 1;
  }
}

function applyMove(board: BoardState, who: Player, from: number | "bar", die: number): BoardState {
  const next: BoardState = { points: board.points.slice(), barW: board.barW, barB: board.barB, offW: board.offW, offB: board.offB };
  if (who === 0) {
    if (from === "bar") {
      next.barW--;
      const target = 24 - die;
      if (next.points[target] === -1) { next.points[target] = 0; next.barB++; }
      next.points[target]++;
    } else {
      next.points[from]--;
      const target = (from as number) - die;
      if (target < 0) {
        next.offW++;
      } else {
        if (next.points[target] === -1) { next.points[target] = 0; next.barB++; }
        next.points[target]++;
      }
    }
  } else {
    if (from === "bar") {
      next.barB--;
      const target = die - 1;
      if (next.points[target] === 1) { next.points[target] = 0; next.barW++; }
      next.points[target]--;
    } else {
      next.points[from]++;
      const target = (from as number) + die;
      if (target >= POINTS) {
        next.offB++;
      } else {
        if (next.points[target] === 1) { next.points[target] = 0; next.barW++; }
        next.points[target]--;
      }
    }
  }
  return next;
}

function anyMovesAvailable(board: BoardState, who: Player, dice: number[]): boolean {
  if (dice.length === 0) return false;
  // Bar first
  if (who === 0 && board.barW > 0) {
    return dice.some((d) => canMove(board, who, "bar", d));
  }
  if (who === 1 && board.barB > 0) {
    return dice.some((d) => canMove(board, who, "bar", d));
  }
  for (const d of dice) {
    for (let i = 0; i < POINTS; i++) {
      const owned = who === 0 ? board.points[i] > 0 : board.points[i] < 0;
      if (!owned) continue;
      if (canMove(board, who, i, d)) return true;
    }
  }
  return false;
}

type Phase =
  | { kind: "intro" }
  | { kind: "roll"; turn: Player }
  | { kind: "move"; turn: Player; dice: number[]; selected: number | "bar" | null }
  | { kind: "end"; winner: Player };

function Checker({ count, who }: { count: number; who: Player }) {
  const bg = who === 0 ? "bg-[#f5efe4]" : "bg-[#1a1008]";
  const text = who === 0 ? "text-[#1a1008]" : "text-[#f5efe4]";
  return <div className={`flex h-5 items-center justify-center rounded-full ${bg} ${text} text-[10px] font-mono border border-border`}>{count > 1 ? count : ""}</div>;
}

export const BackgammonBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <BackgammonRemoteBoard {...props} remote={props.remote} />;
  return <BackgammonLocalBoard {...props} />;
};

const BackgammonLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [board, setBoard] = useState<BoardState>(() => startState());
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(phase.kind + ("turn" in phase ? `-${phase.turn}` : ""));

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic">Roll, move 2 (or 4 on doubles). Bear off first to win.</h2>
        <p className="mt-4 text-sm text-muted">
          White ({players[0].name}) moves from point 24 toward point 1. Black ({players[1].name}) moves the opposite direction. Hit a lone opponent to send them to the bar.
        </p>
        <button type="button" onClick={() => setPhase({ kind: "roll", turn: 0 })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Start — {players[0].name} first →
        </button>
      </section>
    );
  }

  if (phase.kind === "roll") {
    const p = phase;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{players[p.turn].name}&apos;s roll</p>
        <button type="button" onClick={() => {
          const dice = rollPair();
          if (!anyMovesAvailable(board, p.turn, dice)) {
            // Skip
            setPhase({ kind: "roll", turn: (1 - p.turn) as Player });
          } else {
            setPhase({ kind: "move", turn: p.turn, dice, selected: null });
          }
        }} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Roll →
        </button>
      </section>
    );
  }

  if (phase.kind === "end") {
    const winner = players[phase.winner];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Backgammon</p>
        <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{winner.name} wins.</h2>
        <div className="mt-10 flex gap-3">
          <button type="button" onClick={() => onComplete({
            playedAt: new Date().toISOString(),
            players,
            winnerIds: [winner.id],
            durationSec: Math.round((Date.now() - startedAt) / 1000),
            highlights: [`${winner.name} bore off all 15`],
          })} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">Play again</button>
          <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
        </div>
      </section>
    );
  }

  // MOVE
  const p = phase;
  const who = p.turn;
  const active = players[who];

  const onBar = who === 0 ? board.barW : board.barB;
  const mustEnter = onBar > 0;

  const tryMove = (from: number | "bar", die: number) => {
    if (!canMove(board, who, from, die)) return;
    const nextBoard = applyMove(board, who, from, die);
    const nextDice = p.dice.slice();
    nextDice.splice(nextDice.indexOf(die), 1);
    setBoard(nextBoard);
    // Win check
    if ((who === 0 && nextBoard.offW === 15) || (who === 1 && nextBoard.offB === 15)) {
      setPhase({ kind: "end", winner: who });
      return;
    }
    if (nextDice.length === 0 || !anyMovesAvailable(nextBoard, who, nextDice)) {
      setPhase({ kind: "roll", turn: (1 - who) as Player });
    } else {
      setPhase({ kind: "move", turn: who, dice: nextDice, selected: null });
    }
  };

  const selectPoint = (i: number | "bar") => {
    if (mustEnter && i !== "bar") return;
    const owned = i === "bar" ? true : who === 0 ? board.points[i] > 0 : board.points[i] < 0;
    if (!owned) return;
    setPhase({ ...p, selected: i });
  };

  const applyWithDie = (die: number) => {
    if (p.selected === null) return;
    tryMove(p.selected, die);
  };

  // Render
  const renderPoint = (i: number) => {
    const v = board.points[i];
    const cnt = Math.abs(v);
    const owner: Player | null = v > 0 ? 0 : v < 0 ? 1 : null;
    const isSelectable = !mustEnter && owner === who && canSelectPoint(i);
    const isSelected = p.selected === i;
    const items: React.ReactNode[] = [];
    for (let k = 0; k < Math.min(cnt, 5); k++) {
      items.push(<Checker key={k} count={k === 0 ? cnt : 1} who={owner!} />);
    }
    return (
      <button
        key={i}
        type="button"
        onClick={() => selectPoint(i)}
        className={`flex min-h-16 flex-col items-center justify-between gap-0.5 rounded-md border p-1 text-center ${
          isSelected ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)]" : isSelectable ? "border-border hover:border-[hsl(var(--ember)/0.6)]" : "border-border/40"
        }`}
      >
        <span className="font-mono text-[9px] uppercase text-muted">{i + 1}</span>
        <div className="flex flex-col gap-0.5 items-center">{items}</div>
      </button>
    );
  };

  function canSelectPoint(i: number): boolean {
    const owned = who === 0 ? board.points[i] > 0 : board.points[i] < 0;
    if (!owned) return false;
    return p.dice.some((d) => canMove(board, who, i, d));
  }

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>{active.name}&apos;s turn</span>
        <span>Dice: {p.dice.join(" ")}</span>
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        W bar: {board.barW} · B bar: {board.barB} · W off: {board.offW} · B off: {board.offB}
      </p>

      {mustEnter && (
        <button type="button" onClick={() => selectPoint("bar")} className={`mt-3 w-full rounded-md border py-2 font-mono text-xs uppercase ${p.selected === "bar" ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] text-[hsl(var(--ember))]" : "border-border bg-bg/40 text-fg"}`}>
          Re-enter from bar
        </button>
      )}

      <div className="mt-3 grid grid-cols-6 gap-1">
        {/* Top row: points 13-24 */}
        {Array.from({ length: 12 }, (_, k) => 23 - k).reverse().map((i) => renderPoint(i))}
      </div>
      <div className="my-2 h-px bg-border/40" />
      <div className="grid grid-cols-6 gap-1">
        {/* Bottom row: points 1-12 */}
        {Array.from({ length: 12 }, (_, k) => k).map((i) => renderPoint(i))}
      </div>

      {p.selected !== null && (
        <div className="mt-3 rounded-md border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] p-3">
          <p className="font-mono text-[10px] uppercase text-muted">Apply a die</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {p.dice.map((d, i) => (
              <button key={i} type="button" onClick={() => applyWithDie(d)} disabled={!canMove(board, who, p.selected as number | "bar", d)} className="rounded-md border border-border bg-bg/60 py-2 font-mono text-sm disabled:opacity-40">
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={onQuit} className="mt-4 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
    </section>
  );
};

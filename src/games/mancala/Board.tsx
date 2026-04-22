"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Mancala (Kalah variant). Board: two rows of 6 pits + 2 stores.
 *  Start: 4 stones per pit. Sow counter-clockwise one per pit,
 *  pass your own store, skip the opponent's. Last stone in your
 *  store = another turn. Last stone in your own empty pit captures
 *  that stone + the opposite pit into your store. Row empty = game
 *  over; remaining stones go to the player whose row still has them.
 *  Most stones wins.
 *
 *  Index layout:
 *   Row A (bottom, player A) pits 0-5, A's store = 6
 *   Row B (top,    player B) pits 7-12, B's store = 13  */

const STORE_A = 6;
const STORE_B = 13;

function newBoard(): number[] {
  const b = Array<number>(14).fill(4);
  b[STORE_A] = 0;
  b[STORE_B] = 0;
  return b;
}

function isAPit(i: number): boolean { return i >= 0 && i <= 5; }
function isBPit(i: number): boolean { return i >= 7 && i <= 12; }
function oppositeOf(i: number): number { return 12 - i; }  // for pit indices 0..5 ↔ 12..7

function sow(board: number[], start: number, player: "A" | "B"): { board: number[]; extraTurn: boolean } {
  const b = board.slice();
  let stones = b[start];
  b[start] = 0;
  let i = start;
  while (stones > 0) {
    i = (i + 1) % 14;
    // Skip opponent's store.
    if (player === "A" && i === STORE_B) continue;
    if (player === "B" && i === STORE_A) continue;
    b[i]++;
    stones--;
  }
  // Capture rule.
  const myStore = player === "A" ? STORE_A : STORE_B;
  if (player === "A" && isAPit(i) && b[i] === 1 && b[oppositeOf(i)] > 0) {
    b[STORE_A] += 1 + b[oppositeOf(i)];
    b[i] = 0;
    b[oppositeOf(i)] = 0;
  } else if (player === "B" && isBPit(i) && b[i] === 1 && b[oppositeOf(i)] > 0) {
    b[STORE_B] += 1 + b[oppositeOf(i)];
    b[i] = 0;
    b[oppositeOf(i)] = 0;
  }
  const extraTurn = i === myStore;
  return { board: b, extraTurn };
}

function rowEmpty(b: number[], which: "A" | "B"): boolean {
  const [lo, hi] = which === "A" ? [0, 5] : [7, 12];
  for (let i = lo; i <= hi; i++) if (b[i] > 0) return false;
  return true;
}

function sweepRemaining(b: number[]): number[] {
  const next = b.slice();
  let sumA = 0, sumB = 0;
  for (let i = 0; i <= 5; i++) { sumA += next[i]; next[i] = 0; }
  for (let i = 7; i <= 12; i++) { sumB += next[i]; next[i] = 0; }
  next[STORE_A] += sumA;
  next[STORE_B] += sumB;
  return next;
}

export const MancalaBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [board, setBoard] = useState<number[]>(() => newBoard());
  const [turn, setTurn] = useState<"A" | "B">("A");
  useScrollToTop(turn);

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <h2 className="mt-2 font-display text-2xl italic">Pick exactly two.</h2>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  const aPlayer = players[0];
  const bPlayer = players[1];

  // Check endgame.
  const emptyA = rowEmpty(board, "A");
  const emptyB = rowEmpty(board, "B");
  const over = emptyA || emptyB;
  const displayBoard = over ? sweepRemaining(board) : board;

  function tryPlay(i: number) {
    if (over) return;
    if (turn === "A" && !isAPit(i)) return;
    if (turn === "B" && !isBPit(i)) return;
    if (board[i] === 0) return;
    const { board: next, extraTurn } = sow(board, i, turn);
    setBoard(next);
    if (!extraTurn) setTurn(turn === "A" ? "B" : "A");
  }

  function finish() {
    const aScore = displayBoard[STORE_A];
    const bScore = displayBoard[STORE_B];
    let winnerIds: string[];
    if (aScore > bScore) winnerIds = [aPlayer.id];
    else if (bScore > aScore) winnerIds = [bPlayer.id];
    else winnerIds = players.map((p) => p.id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${aPlayer.name} ${aScore} — ${bPlayer.name} ${bScore}`],
    });
  }

  function Pit({ idx, color }: { idx: number; color: "A" | "B" }) {
    const count = displayBoard[idx];
    const canTap = !over && turn === color && board[idx] > 0 && ((color === "A" && isAPit(idx)) || (color === "B" && isBPit(idx)));
    return (
      <button
        type="button"
        disabled={!canTap}
        onClick={() => tryPlay(idx)}
        className={`flex aspect-square flex-col items-center justify-center rounded-full border-2 ${
          canTap ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] hover:bg-[hsl(var(--ember)/0.2)]" : "border-border/60 bg-bg/40"
        }`}
      >
        <span className="font-display text-2xl italic text-fg">{count}</span>
      </button>
    );
  }

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>
          <span className="text-[hsl(var(--ember))]">{aPlayer.name}</span> {displayBoard[STORE_A]} · {bPlayer.name} {displayBoard[STORE_B]}
        </span>
        <span>{over ? "Game over" : `${turn === "A" ? aPlayer.name : bPlayer.name}'s turn`}</span>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-[#1a1008] p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-24 w-14 flex-col items-center justify-center rounded-xl border-2 border-border bg-[#2a1a10] text-center">
            <span className="font-mono text-[10px] uppercase text-muted">{bPlayer.name}</span>
            <span className="mt-1 font-display text-2xl italic text-fg">{displayBoard[STORE_B]}</span>
          </div>
          <div className="flex-1 space-y-2">
            {/* Row B: 12..7 left to right */}
            <div className="grid grid-cols-6 gap-1.5">
              {[12, 11, 10, 9, 8, 7].map((idx) => <Pit key={idx} idx={idx} color="B" />)}
            </div>
            {/* Row A: 0..5 left to right */}
            <div className="grid grid-cols-6 gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((idx) => <Pit key={idx} idx={idx} color="A" />)}
            </div>
          </div>
          <div className="flex h-24 w-14 flex-col items-center justify-center rounded-xl border-2 border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] text-center">
            <span className="font-mono text-[10px] uppercase text-muted">{aPlayer.name}</span>
            <span className="mt-1 font-display text-2xl italic text-[hsl(var(--ember))]">{displayBoard[STORE_A]}</span>
          </div>
        </div>
      </div>

      {over && (
        <div className="mt-6 text-center">
          <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
            {displayBoard[STORE_A] > displayBoard[STORE_B] ? `${aPlayer.name} wins.` :
             displayBoard[STORE_B] > displayBoard[STORE_A] ? `${bPlayer.name} wins.` : "Draw."}
          </h2>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={finish} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
              Play again
            </button>
            <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
              Back
            </button>
          </div>
        </div>
      )}

      {!over && (
        <>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            Tap a pit on your row. Sow counter-clockwise.
          </p>
          <button type="button" onClick={onQuit} className="mt-4 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
            Quit
          </button>
        </>
      )}
    </section>
  );
};

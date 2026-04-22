"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Reversi / Othello — 8x8, flanking captures.
 *
 *  On your turn you place a disc such that it and one of your existing
 *  discs sandwich a continuous run of opponent discs in at least one
 *  direction. All flanked discs flip. No legal move → pass. Neither
 *  can move → game over; majority wins. */

const SIZE = 8;
type Cell = "B" | "W" | null;
type Grid = Cell[][];

const DIRS: [number, number][] = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function startGrid(): Grid {
  const g: Grid = Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null));
  g[3][3] = "W"; g[3][4] = "B";
  g[4][3] = "B"; g[4][4] = "W";
  return g;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function flipsFor(g: Grid, r: number, c: number, disc: "B" | "W"): [number, number][] {
  if (g[r][c] !== null) return [];
  const opp = disc === "B" ? "W" : "B";
  const all: [number, number][] = [];
  for (const [dr, dc] of DIRS) {
    const run: [number, number][] = [];
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc) && g[nr][nc] === opp) {
      run.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (run.length > 0 && inBounds(nr, nc) && g[nr][nc] === disc) {
      all.push(...run);
    }
  }
  return all;
}

function legalMoves(g: Grid, disc: "B" | "W"): Set<string> {
  const out = new Set<string>();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (flipsFor(g, r, c, disc).length > 0) out.add(`${r},${c}`);
    }
  }
  return out;
}

function applyMove(g: Grid, r: number, c: number, disc: "B" | "W"): Grid {
  const flips = flipsFor(g, r, c, disc);
  if (flips.length === 0) return g;
  const next = g.map((row) => row.slice());
  next[r][c] = disc;
  for (const [fr, fc] of flips) next[fr][fc] = disc;
  return next;
}

function countDiscs(g: Grid): { B: number; W: number } {
  let B = 0, W = 0;
  for (const row of g) for (const c of row) {
    if (c === "B") B++;
    else if (c === "W") W++;
  }
  return { B, W };
}

export const ReversiBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [grid, setGrid] = useState<Grid>(() => startGrid());
  const [turn, setTurn] = useState<"B" | "W">("B");
  const [passedLast, setPassedLast] = useState(false);
  useScrollToTop(turn);

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <h2 className="mt-2 font-display text-2xl italic">Pick exactly two players.</h2>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  const blackPlayer = players[0];
  const whitePlayer = players[1];
  const legal = legalMoves(grid, turn);
  const oppLegal = legalMoves(grid, turn === "B" ? "W" : "B");
  const over = legal.size === 0 && oppLegal.size === 0;
  const counts = countDiscs(grid);

  function play(r: number, c: number) {
    if (over) return;
    if (!legal.has(`${r},${c}`)) return;
    const next = applyMove(grid, r, c, turn);
    setGrid(next);
    setTurn(turn === "B" ? "W" : "B");
    setPassedLast(false);
  }

  function doPass() {
    setTurn(turn === "B" ? "W" : "B");
    setPassedLast(true);
  }

  function finish() {
    let winnerIds: string[];
    const highlight = `Black ${counts.B} — White ${counts.W}`;
    if (counts.B > counts.W) winnerIds = [blackPlayer.id];
    else if (counts.W > counts.B) winnerIds = [whitePlayer.id];
    else winnerIds = players.map((p) => p.id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [highlight],
    });
  }

  const currentName = turn === "B" ? blackPlayer.name : whitePlayer.name;

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>{blackPlayer.name} ● {counts.B} / {whitePlayer.name} ○ {counts.W}</span>
        <span className={turn === "B" ? "text-fg" : "text-[hsl(var(--ember))]"}>
          {over ? "Game over" : passedLast ? `${currentName} (forced after pass)` : `${currentName}'s turn`}
        </span>
      </div>

      <div className="mt-4 grid gap-0.5 rounded-md border border-border bg-[#1a3f1a] p-1" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}>
        {grid.flatMap((row, r) =>
          row.map((cell, c) => {
            const isLegal = !over && legal.has(`${r},${c}`);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => play(r, c)}
                disabled={!isLegal || over}
                className="flex aspect-square items-center justify-center bg-[#1f4f1f] transition-colors hover:bg-[#2a5f2a] disabled:hover:bg-[#1f4f1f]"
              >
                {cell === "B" && <div className="h-4/5 w-4/5 rounded-full bg-[#100d0b] shadow-inner" />}
                {cell === "W" && <div className="h-4/5 w-4/5 rounded-full bg-[#f5efe4] shadow-inner" />}
                {isLegal && cell === null && <div className="h-2 w-2 rounded-full bg-[hsl(var(--ember)/0.6)]" />}
              </button>
            );
          }),
        )}
      </div>

      {!over && legal.size === 0 && (
        <div className="mt-4 rounded-md border border-border bg-bg/40 p-3 text-center">
          <p className="font-mono text-xs text-muted">{currentName} has no legal moves.</p>
          <button type="button" onClick={doPass} className="mt-2 rounded-md bg-[hsl(var(--ember))] px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg">
            Pass turn
          </button>
        </div>
      )}

      {over && (
        <div className="mt-6 text-center">
          <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
            {counts.B > counts.W ? `${blackPlayer.name} wins.` : counts.W > counts.B ? `${whitePlayer.name} wins.` : "Draw."}
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
        <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
          Quit
        </button>
      )}
    </section>
  );
};

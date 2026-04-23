"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { CheckersRemoteBoard } from "./RemoteBoard";

/** American-style Checkers, 8x8.
 *
 *  Pieces move one square diagonally toward the opponent. Jumps
 *  capture an enemy piece and land one square past it; multi-jumps
 *  are chained until no more jumps are available. Reach the far row
 *  and the piece is crowned (can move backward too).
 *
 *  MVP ruleset: jumps are OPTIONAL (not forced), which is common in
 *  casual play. Win = opponent has no pieces, or no legal moves. */

const SIZE = 8;

type Piece = { color: "dark" | "light"; king: boolean } | null;
type Grid = Piece[][];

function startGrid(): Grid {
  const g: Grid = Array.from({ length: SIZE }, () => Array<Piece>(SIZE).fill(null));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) g[r][c] = { color: "dark", king: false };
        else if (r > 4) g[r][c] = { color: "light", king: false };
      }
    }
  }
  return g;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function directionsFor(p: Piece): [number, number][] {
  if (!p) return [];
  if (p.king) return [[-1,-1],[-1,1],[1,-1],[1,1]];
  return p.color === "dark" ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
}

/** Simple moves (one step, no capture) from (r,c). */
function simpleMoves(g: Grid, r: number, c: number): [number, number][] {
  const p = g[r][c];
  if (!p) return [];
  const out: [number, number][] = [];
  for (const [dr, dc] of directionsFor(p)) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && g[nr][nc] === null) out.push([nr, nc]);
  }
  return out;
}

/** Jump moves (single hop capture) from (r,c). Each entry is the
 *  destination + captured-cell. */
function jumpMoves(g: Grid, r: number, c: number): { to: [number, number]; captured: [number, number] }[] {
  const p = g[r][c];
  if (!p) return [];
  const out: { to: [number, number]; captured: [number, number] }[] = [];
  for (const [dr, dc] of directionsFor(p)) {
    const mr = r + dr, mc = c + dc;
    const nr = r + 2 * dr, nc = c + 2 * dc;
    if (!inBounds(nr, nc)) continue;
    const mid = g[mr][mc];
    if (!mid || mid.color === p.color) continue;
    if (g[nr][nc] !== null) continue;
    out.push({ to: [nr, nc], captured: [mr, mc] });
  }
  return out;
}

function applyMove(g: Grid, from: [number, number], to: [number, number], captured: [number, number] | null): Grid {
  const next = g.map((row) => row.slice());
  const [fr, fc] = from;
  const [tr, tc] = to;
  const piece = next[fr][fc];
  next[fr][fc] = null;
  if (captured) next[captured[0]][captured[1]] = null;
  // Crown if reaches far row.
  const crowning = !!piece && !piece.king && ((piece.color === "dark" && tr === SIZE - 1) || (piece.color === "light" && tr === 0));
  next[tr][tc] = piece ? { color: piece.color, king: piece.king || crowning } : null;
  return next;
}

function countPieces(g: Grid): { dark: number; light: number } {
  let dark = 0, light = 0;
  for (const row of g) for (const cell of row) {
    if (cell?.color === "dark") dark++;
    else if (cell?.color === "light") light++;
  }
  return { dark, light };
}

function hasAnyMoves(g: Grid, color: "dark" | "light"): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = g[r][c];
      if (!p || p.color !== color) continue;
      if (simpleMoves(g, r, c).length > 0) return true;
      if (jumpMoves(g, r, c).length > 0) return true;
    }
  }
  return false;
}

export const CheckersBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <CheckersRemoteBoard {...props} remote={props.remote} />;
  return <CheckersLocalBoard {...props} />;
};

const CheckersLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [grid, setGrid] = useState<Grid>(() => startGrid());
  const [turn, setTurn] = useState<"dark" | "light">("dark");
  const [selected, setSelected] = useState<[number, number] | null>(null);
  // When mid-jump-chain, lock selection to that piece until chain ends.
  const [mustChainFrom, setMustChainFrom] = useState<[number, number] | null>(null);
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

  const darkPlayer = players[0];
  const lightPlayer = players[1];
  const counts = countPieces(grid);
  const opp = turn === "dark" ? "light" : "dark";
  const oppCanMove = hasAnyMoves(grid, opp);
  const thisCanMove = hasAnyMoves(grid, turn);
  const over = counts.dark === 0 || counts.light === 0 || !thisCanMove;

  const selectedJumps = selected ? jumpMoves(grid, selected[0], selected[1]) : [];
  const selectedSimples = selected && !mustChainFrom ? simpleMoves(grid, selected[0], selected[1]) : [];

  function selectCell(r: number, c: number) {
    if (over) return;
    const cell = grid[r][c];
    if (mustChainFrom) return; // locked to chain piece; moves only
    if (cell && cell.color === turn) {
      setSelected([r, c]);
    }
  }

  function tryMoveTo(r: number, c: number) {
    if (over || !selected) return;
    const jumpsAvail = jumpMoves(grid, selected[0], selected[1]);
    const jump = jumpsAvail.find((m) => m.to[0] === r && m.to[1] === c);
    if (jump) {
      const next = applyMove(grid, selected, jump.to, jump.captured);
      const moreJumps = jumpMoves(next, jump.to[0], jump.to[1]);
      setGrid(next);
      if (moreJumps.length > 0) {
        setSelected([jump.to[0], jump.to[1]]);
        setMustChainFrom([jump.to[0], jump.to[1]]);
      } else {
        setSelected(null);
        setMustChainFrom(null);
        setTurn(opp);
      }
      return;
    }
    if (mustChainFrom) return;
    const simples = simpleMoves(grid, selected[0], selected[1]);
    if (simples.some(([sr, sc]) => sr === r && sc === c)) {
      const next = applyMove(grid, selected, [r, c], null);
      setGrid(next);
      setSelected(null);
      setTurn(opp);
    }
  }

  function finish() {
    let winnerIds: string[];
    if (counts.dark === 0 || (!thisCanMove && turn === "dark")) winnerIds = [lightPlayer.id];
    else if (counts.light === 0 || (!thisCanMove && turn === "light")) winnerIds = [darkPlayer.id];
    else winnerIds = players.map((p) => p.id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${darkPlayer.name} ${counts.dark} pcs — ${lightPlayer.name} ${counts.light} pcs`],
    });
  }

  const targets = new Set([
    ...selectedJumps.map((j) => `${j.to[0]},${j.to[1]}`),
    ...selectedSimples.map(([r, c]) => `${r},${c}`),
  ]);

  const currentName = turn === "dark" ? darkPlayer.name : lightPlayer.name;

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>
          <span className="text-[hsl(var(--ember))]">{darkPlayer.name}</span> {counts.dark} vs {lightPlayer.name} {counts.light}
        </span>
        <span>{over ? "Game over" : `${currentName}'s turn`}</span>
      </div>

      <div className="mt-4 grid gap-0 rounded-md border border-border bg-bg/40 p-1" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}>
        {grid.flatMap((row, r) =>
          row.map((cell, c) => {
            const isDark = (r + c) % 2 === 1;
            const isSelected = selected && selected[0] === r && selected[1] === c;
            const isTarget = targets.has(`${r},${c}`);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => {
                  if (isTarget) tryMoveTo(r, c);
                  else selectCell(r, c);
                }}
                disabled={over || (!cell && !isTarget && !isSelected)}
                className={`flex aspect-square items-center justify-center ${
                  isDark ? "bg-[#3a2a1a]" : "bg-[#f5efe4]"
                } ${isSelected ? "ring-2 ring-inset ring-[hsl(var(--ember))]" : ""} ${isTarget ? "ring-2 ring-inset ring-[hsl(var(--ember)/0.6)]" : ""}`}
              >
                {cell && (
                  <div
                    className={`flex h-4/5 w-4/5 items-center justify-center rounded-full border-2 ${
                      cell.color === "dark"
                        ? "border-[#0a0705] bg-[#1a1008]"
                        : "border-[#e0d4bc] bg-[#faf3e2]"
                    }`}
                  >
                    {cell.king && (
                      <span className={`font-display text-xs italic ${cell.color === "dark" ? "text-[hsl(var(--ember))]" : "text-[#c9a94c]"}`}>K</span>
                    )}
                  </div>
                )}
                {!cell && isTarget && (
                  <div className="h-2 w-2 rounded-full bg-[hsl(var(--ember)/0.7)]" />
                )}
              </button>
            );
          }),
        )}
      </div>

      {over && (
        <div className="mt-6 text-center">
          <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
            {counts.dark === 0 ? `${lightPlayer.name} wins.` :
             counts.light === 0 ? `${darkPlayer.name} wins.` :
             !thisCanMove ? `${turn === "dark" ? lightPlayer.name : darkPlayer.name} wins (stalemate).` : "Draw."}
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

      {!over && !oppCanMove && (
        <p className="mt-4 text-center font-mono text-xs text-muted">{opp === "dark" ? darkPlayer.name : lightPlayer.name} has no moves — they&apos;ll lose next.</p>
      )}

      {!over && (
        <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
          Quit
        </button>
      )}
    </section>
  );
};

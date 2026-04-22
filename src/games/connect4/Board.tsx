"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Connect 4 — 7 columns × 6 rows, gravity drop. Standard ruleset:
 *  first to four-in-a-row (horizontal / vertical / either diagonal)
 *  wins. Full board without a connect is a draw. */

const COLS = 7;
const ROWS = 6;

type Disc = "R" | "Y" | null;
type Grid = Disc[][]; // rows top→bottom, cols left→right

function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array<Disc>(COLS).fill(null));
}

function dropInto(grid: Grid, col: number, disc: "R" | "Y"): { grid: Grid; row: number } | null {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (grid[r][col] === null) {
      const next = grid.map((row) => row.slice());
      next[r][col] = disc;
      return { grid: next, row: r };
    }
  }
  return null;
}

function detectWin(grid: Grid): { line: [number, number][]; disc: "R" | "Y" } | null {
  // Check 4 directions from each cell.
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const disc = grid[r][c];
      if (!disc) continue;
      for (const [dr, dc] of dirs) {
        const line: [number, number][] = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (grid[nr][nc] !== disc) break;
          line.push([nr, nc]);
        }
        if (line.length === 4) return { line, disc };
      }
    }
  }
  return null;
}

export const Connect4Board: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [grid, setGrid] = useState<Grid>(() => emptyGrid());
  const [turn, setTurn] = useState<"R" | "Y">("R");
  useScrollToTop(turn);

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <h2 className="mt-2 font-display text-2xl italic">Pick exactly two players from the roster.</h2>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">
          Back
        </button>
      </section>
    );
  }

  const redPlayer = players[0];
  const yellowPlayer = players[1];
  const win = detectWin(grid);
  const full = grid[0].every((c) => c !== null);
  const over = win !== null || full;

  function play(col: number) {
    if (over) return;
    const res = dropInto(grid, col, turn);
    if (!res) return;
    setGrid(res.grid);
    setTurn(turn === "R" ? "Y" : "R");
  }

  function finish(winner: "R" | "Y" | "draw") {
    const winnerIds =
      winner === "draw"
        ? players.map((p) => p.id)
        : winner === "R"
          ? [redPlayer.id]
          : [yellowPlayer.id];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: winner === "draw" ? ["Stalemate"] : [`${winner === "R" ? redPlayer.name : yellowPlayer.name} connects four`],
    });
  }

  const currentName = turn === "R" ? redPlayer.name : yellowPlayer.name;
  const winCells = new Set(win?.line.map(([r, c]) => `${r},${c}`) ?? []);

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>
          <span className="text-[hsl(var(--ember))]">{redPlayer.name}</span> vs {yellowPlayer.name}
        </span>
        <span>{over ? "Game over" : `${currentName}'s turn`}</span>
      </div>

      {/* Column-tap buttons above the grid */}
      <div className="mt-4 grid grid-cols-7 gap-1">
        {Array.from({ length: COLS }, (_, c) => {
          const colFull = grid[0][c] !== null;
          return (
            <button
              key={c}
              type="button"
              onClick={() => play(c)}
              disabled={over || colFull}
              aria-label={`Drop in column ${c + 1}`}
              className={`flex aspect-square items-center justify-center rounded-md border text-xs transition-colors ${
                over || colFull
                  ? "border-border/60 text-muted/40"
                  : "border-border hover:border-[hsl(var(--ember)/0.5)] hover:bg-[hsl(var(--ember)/0.05)]"
              } ${turn === "R" ? "text-[hsl(var(--ember))]" : "text-[#f2c94c]"}`}
            >
              ↓
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid gap-1 rounded-md border border-border bg-bg/40 p-2" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {grid.flatMap((row, r) =>
          row.map((cell, c) => {
            const highlight = winCells.has(`${r},${c}`);
            return (
              <div
                key={`${r}-${c}`}
                className={`flex aspect-square items-center justify-center rounded-full border ${
                  highlight ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)]" : "border-border/60 bg-bg"
                }`}
              >
                {cell === "R" && (
                  <div className={`h-4/5 w-4/5 rounded-full ${highlight ? "bg-[hsl(var(--ember))]" : "bg-[hsl(var(--ember))]"}`} />
                )}
                {cell === "Y" && (
                  <div className={`h-4/5 w-4/5 rounded-full ${highlight ? "bg-[#f2c94c]" : "bg-[#f2c94c]"}`} />
                )}
              </div>
            );
          }),
        )}
      </div>

      {over && (
        <div className="mt-6 text-center">
          <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
            {win ? `${win.disc === "R" ? redPlayer.name : yellowPlayer.name} wins` : "Stalemate"}
          </h2>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => finish(win ? win.disc : "draw")} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
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

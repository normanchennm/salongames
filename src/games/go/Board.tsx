"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { GoRemoteBoard } from "./RemoteBoard";

/** Go 9×9 — 2 players, area scoring.
 *
 *  Black plays first. Place a stone on any empty intersection. After
 *  placement, any opposing groups without liberties are removed, then
 *  any of your own groups without liberties are removed (suicide is
 *  allowed only if it captured something; otherwise the move is
 *  rejected). Two consecutive passes end the game.
 *
 *  Area scoring: each side counts stones on the board + territory
 *  (empty intersections reachable only from that side's stones).
 *  White gets a 6.5 komi. Higher total wins.
 *
 *  Deferred: strict ko rule (players self-police). */

const N = 9;
type Color = "B" | "W";
type Cell = Color | null;
type Grid = Cell[][];

const DIRS: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];

function emptyGrid(): Grid {
  return Array.from({ length: N }, () => Array<Cell>(N).fill(null));
}

function inBounds(r: number, c: number): boolean { return r >= 0 && r < N && c >= 0 && c < N; }

function floodGroup(g: Grid, r: number, c: number): { cells: [number, number][]; liberties: number } {
  const color = g[r][c];
  if (color === null) return { cells: [], liberties: 0 };
  const visited = new Set<string>();
  const libs = new Set<string>();
  const stack: [number, number][] = [[r, c]];
  const cells: [number, number][] = [];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const key = `${cr},${cc}`;
    if (visited.has(key)) continue;
    visited.add(key);
    cells.push([cr, cc]);
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc;
      if (!inBounds(nr, nc)) continue;
      if (g[nr][nc] === null) libs.add(`${nr},${nc}`);
      else if (g[nr][nc] === color) stack.push([nr, nc]);
    }
  }
  return { cells, liberties: libs.size };
}

function tryPlay(g: Grid, r: number, c: number, color: Color): Grid | null {
  if (g[r][c] !== null) return null;
  const next = g.map((row) => row.slice());
  next[r][c] = color;
  const opp: Color = color === "B" ? "W" : "B";
  // Remove opponent groups without liberties adjacent to the new stone.
  for (const [dr, dc] of DIRS) {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    if (next[nr][nc] !== opp) continue;
    const { cells, liberties } = floodGroup(next, nr, nc);
    if (liberties === 0) for (const [x, y] of cells) next[x][y] = null;
  }
  // Own group liberty check.
  const ownGroup = floodGroup(next, r, c);
  if (ownGroup.liberties === 0) return null; // suicide (didn't capture anything)
  return next;
}

function score(g: Grid): { black: number; white: number } {
  // Area scoring: stones + territory. Territory = empty region reachable only from one color's stones.
  const visited = new Set<string>();
  let bStones = 0, wStones = 0, bTerr = 0, wTerr = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (g[r][c] === "B") bStones++;
      else if (g[r][c] === "W") wStones++;
    }
  }
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (g[r][c] !== null) continue;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      // BFS the empty region.
      const stack: [number, number][] = [[r, c]];
      const region: [number, number][] = [];
      const border = new Set<Color>();
      while (stack.length) {
        const [cr, cc] = stack.pop()!;
        const k = `${cr},${cc}`;
        if (visited.has(k)) continue;
        visited.add(k);
        region.push([cr, cc]);
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr, nc = cc + dc;
          if (!inBounds(nr, nc)) continue;
          if (g[nr][nc] === null) stack.push([nr, nc]);
          else border.add(g[nr][nc]!);
        }
      }
      if (border.size === 1) {
        if (border.has("B")) bTerr += region.length;
        else wTerr += region.length;
      }
    }
  }
  return { black: bStones + bTerr, white: wStones + wTerr };
}

type Phase =
  | { kind: "playing"; turn: Color; passes: number }
  | { kind: "end" };

export const GoBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <GoRemoteBoard {...props} remote={props.remote} />;
  return <GoLocalBoard {...props} />;
};

const GoLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [grid, setGrid] = useState<Grid>(() => emptyGrid());
  const [phase, setPhase] = useState<Phase>({ kind: "playing", turn: "B", passes: 0 });
  useScrollToTop(phase.kind + ("turn" in phase ? `-${phase.turn}` : ""));

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  const bPlayer = players[0];
  const wPlayer = players[1];

  if (phase.kind === "end") {
    const s = score(grid);
    const komi = 6.5;
    const wTotal = s.white + komi;
    const winnerIdx = s.black > wTotal ? 0 : 1;
    const winner = players[winnerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Game over</p>
        <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">{winner.name} wins.</h2>
        <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
          <div className="flex justify-between text-sm"><span>Black ({bPlayer.name})</span><span>{s.black}</span></div>
          <div className="flex justify-between text-sm"><span>White ({wPlayer.name}) + 6.5 komi</span><span>{wTotal}</span></div>
        </div>
        <div className="mt-10 flex gap-3">
          <button type="button" onClick={() => onComplete({
            playedAt: new Date().toISOString(),
            players,
            winnerIds: [winner.id],
            durationSec: Math.round((Date.now() - startedAt) / 1000),
            highlights: [`${s.black} vs ${wTotal}`],
          })} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">Play again</button>
          <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
        </div>
      </section>
    );
  }

  const p = phase;
  const active = p.turn === "B" ? bPlayer : wPlayer;

  const play = (r: number, c: number) => {
    const next = tryPlay(grid, r, c, p.turn);
    if (!next) return;
    setGrid(next);
    setPhase({ kind: "playing", turn: p.turn === "B" ? "W" : "B", passes: 0 });
  };

  const passTurn = () => {
    const passes = p.passes + 1;
    if (passes >= 2) { setPhase({ kind: "end" }); return; }
    setPhase({ kind: "playing", turn: p.turn === "B" ? "W" : "B", passes });
  };

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>{bPlayer.name} ● vs {wPlayer.name} ○</span>
        <span className={p.turn === "B" ? "text-fg" : "text-[hsl(var(--ember))]"}>{active.name}&apos;s turn</span>
      </div>

      <div className="mt-4 grid gap-0.5 rounded-md border border-border bg-[#c9a96a] p-2" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
        {grid.flatMap((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              onClick={() => play(r, c)}
              disabled={cell !== null}
              className="flex aspect-square items-center justify-center transition-colors hover:bg-[#b89860] disabled:hover:bg-[#c9a96a]"
            >
              {cell === "B" && <div className="h-4/5 w-4/5 rounded-full bg-[#0a0705]" />}
              {cell === "W" && <div className="h-4/5 w-4/5 rounded-full bg-[#f5efe4]" />}
              {cell === null && <div className="h-1 w-1 rounded-full bg-[#1a1008]/40" />}
            </button>
          )),
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={passTurn} className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg">
          Pass
        </button>
        <button type="button" onClick={onQuit} className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg">
          Quit
        </button>
      </div>
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Two passes in a row end the game. {p.passes === 1 ? "Another pass ends it." : ""}
      </p>
    </section>
  );
};

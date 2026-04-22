"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Battleship — 10x10 pass-and-play. Each player secretly places
 *  5 ships (lengths 5,4,3,3,2), then they alternate shots. After a
 *  shot, a handoff screen hides the attacker's board from the next
 *  player. First to sink all enemy ships wins. */

const SIZE = 10;
const SHIP_LENGTHS = [5, 4, 3, 3, 2];
const SHIP_NAMES = ["Carrier (5)", "Battleship (4)", "Cruiser (3)", "Submarine (3)", "Destroyer (2)"];

type Orientation = "H" | "V";
interface Ship { length: number; cells: [number, number][]; }
interface Grid {
  ships: Ship[];                            // placed ships
  hits: boolean[][];                        // 10x10 of whether this cell was shot (and what was there)
}

function emptyGrid(): Grid {
  return {
    ships: [],
    hits: Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false)),
  };
}

function cellIsShip(g: Grid, r: number, c: number): boolean {
  return g.ships.some((s) => s.cells.some(([sr, sc]) => sr === r && sc === c));
}
function shipAt(g: Grid, r: number, c: number): Ship | null {
  return g.ships.find((s) => s.cells.some(([sr, sc]) => sr === r && sc === c)) ?? null;
}
function isSunk(g: Grid, ship: Ship): boolean {
  return ship.cells.every(([r, c]) => g.hits[r][c]);
}
function allSunk(g: Grid): boolean {
  return g.ships.every((s) => isSunk(g, s));
}

function canPlace(g: Grid, r: number, c: number, length: number, orient: Orientation): boolean {
  for (let k = 0; k < length; k++) {
    const rr = orient === "V" ? r + k : r;
    const cc = orient === "H" ? c + k : c;
    if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return false;
    if (cellIsShip(g, rr, cc)) return false;
  }
  return true;
}

type Phase =
  | { kind: "intro" }
  | { kind: "place-pass"; playerIdx: number }
  | { kind: "place"; playerIdx: number; shipIdx: number; orient: Orientation }
  | { kind: "place-done"; playerIdx: number }
  | { kind: "turn-pass"; attackerIdx: number }
  | { kind: "turn-aim"; attackerIdx: number }
  | { kind: "turn-result"; attackerIdx: number; hit: boolean; sunkShip: Ship | null; won: boolean; shot: [number, number] }
  | { kind: "end"; winnerIdx: number };

export const BattleshipBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [grids, setGrids] = useState<Grid[]>(() => [emptyGrid(), emptyGrid()]);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  useScrollToTop(phase.kind + ("shipIdx" in phase ? `-${phase.shipIdx}` : "") + ("attackerIdx" in phase ? `-${phase.attackerIdx}` : ""));

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <h2 className="mt-2 font-display text-2xl italic">Pick exactly two players.</h2>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  const PlayerGrid = ({ grid, showShips, onCellClick, previewRange, blockedOnMiss }: {
    grid: Grid;
    showShips: boolean;
    onCellClick?: (r: number, c: number) => void;
    previewRange?: [number, number][];
    blockedOnMiss?: boolean;
  }) => {
    const previewSet = new Set((previewRange ?? []).map(([r, c]) => `${r},${c}`));
    return (
      <div className="grid gap-0.5 rounded-md border border-border bg-bg/40 p-1.5" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}>
        {Array.from({ length: SIZE }).flatMap((_, r) =>
          Array.from({ length: SIZE }).map((_, c) => {
            const isShip = cellIsShip(grid, r, c);
            const isHit = grid.hits[r][c];
            const key = `${r},${c}`;
            const isPreview = previewSet.has(key);
            let bg = "bg-[#142a3a]"; // sea
            if (showShips && isShip && !isHit) bg = "bg-[#4a5a6a]";
            if (isHit && isShip) bg = "bg-[hsl(var(--ember))]";
            if (isHit && !isShip) bg = "bg-[#1a1a22]";
            if (isPreview) bg = "bg-[hsl(var(--ember)/0.4)]";
            return (
              <button
                key={key}
                type="button"
                onClick={() => onCellClick?.(r, c)}
                disabled={!onCellClick || (blockedOnMiss && grid.hits[r][c])}
                className={`flex aspect-square items-center justify-center ${bg} transition-colors`}
                aria-label={`${String.fromCharCode(65 + r)}${c + 1}`}
              >
                {isHit && isShip && <span className="text-[10px] text-bg">✕</span>}
                {isHit && !isShip && <span className="h-1 w-1 rounded-full bg-white/60" />}
              </button>
            );
          }),
        )}
      </div>
    );
  };

  // --- INTRO ---------------------------------------------------
  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic leading-tight">Place your fleet in private. Then sink the other.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Each player places 5 ships on a 10×10 grid — privately, with the phone. Then you alternate shots. Pass the phone between turns. First to sink all the opponent&apos;s ships wins.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "place-pass", playerIdx: 0 })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Pass to {players[0].name} to place →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // --- PLACE PASS ----------------------------------------------
  if (phase.kind === "place-pass") {
    const p = players[phase.playerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Placement {phase.playerIdx + 1} / 2</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {p.name}.</h2>
        <p className="mt-4 text-sm text-muted">Only {p.name} should see the next screen.</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "place", playerIdx: phase.playerIdx, shipIdx: 0, orient: "H" })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {p.name} — place →
        </button>
      </section>
    );
  }

  // --- PLACE ---------------------------------------------------
  if (phase.kind === "place") {
    const pl = phase;
    const grid = grids[pl.playerIdx];
    const length = SHIP_LENGTHS[pl.shipIdx];
    const p = players[pl.playerIdx];

    const tryPlace = (r: number, c: number) => {
      if (!canPlace(grid, r, c, length, pl.orient)) return;
      const cells: [number, number][] = [];
      for (let k = 0; k < length; k++) {
        const rr = pl.orient === "V" ? r + k : r;
        const cc = pl.orient === "H" ? c + k : c;
        cells.push([rr, cc]);
      }
      const nextShips = [...grid.ships, { length, cells }];
      const nextGrid: Grid = { ...grid, ships: nextShips };
      const nextGrids = [...grids];
      nextGrids[pl.playerIdx] = nextGrid;
      setGrids(nextGrids);
      if (pl.shipIdx + 1 >= SHIP_LENGTHS.length) {
        setPhase({ kind: "place-done", playerIdx: pl.playerIdx });
      } else {
        setPhase({ kind: "place", playerIdx: pl.playerIdx, shipIdx: pl.shipIdx + 1, orient: pl.orient });
      }
    };

    // Compute preview for hover target — for mobile simplicity, we
    // tap to place and the preview is from the last-hovered cell.
    // Skip preview in pass-and-play; just check on click.

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{p.name} — place {SHIP_NAMES[pl.shipIdx]}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            {pl.orient === "H" ? "Horizontal" : "Vertical"}
          </span>
          <button
            type="button"
            onClick={() => setPhase({ kind: "place", playerIdx: pl.playerIdx, shipIdx: pl.shipIdx, orient: pl.orient === "H" ? "V" : "H" })}
            className="rounded-md border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
          >
            Rotate
          </button>
        </div>
        <div className="mt-3">
          <PlayerGrid grid={grid} showShips={true} onCellClick={tryPlace} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Tap a cell to drop the bow. Ship extends {pl.orient === "H" ? "right" : "down"} by {length}.
        </p>
        <div className="mt-3 rounded-md border border-border bg-bg/40 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Fleet</p>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {SHIP_NAMES.map((name, i) => (
              <li key={name} className={`flex justify-between ${i < pl.shipIdx ? "text-muted/60 line-through" : i === pl.shipIdx ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
                <span>{name}</span>
                <span>{i < pl.shipIdx ? "placed" : i === pl.shipIdx ? "placing…" : "pending"}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // --- PLACE DONE ----------------------------------------------
  if (phase.kind === "place-done") {
    const next = phase.playerIdx + 1;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Fleet ready</p>
        <h2 className="mt-2 font-display text-3xl italic">Hide the phone, then hand off.</h2>
        <button
          type="button"
          onClick={() => {
            if (next >= players.length) setPhase({ kind: "turn-pass", attackerIdx: 0 });
            else setPhase({ kind: "place-pass", playerIdx: next });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {next >= players.length ? `Start — pass to ${players[0].name} →` : `Pass to ${players[next].name} →`}
        </button>
      </section>
    );
  }

  // --- TURN PASS -----------------------------------------------
  if (phase.kind === "turn-pass") {
    const attacker = players[phase.attackerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Your turn to fire</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {attacker.name}.</h2>
        <button
          type="button"
          onClick={() => setPhase({ kind: "turn-aim", attackerIdx: phase.attackerIdx })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          I&apos;m {attacker.name} — show the board →
        </button>
      </section>
    );
  }

  // --- TURN AIM ------------------------------------------------
  if (phase.kind === "turn-aim") {
    const pa = phase;
    const attacker = players[pa.attackerIdx];
    const targetIdx = 1 - pa.attackerIdx;
    const targetGrid = grids[targetIdx];

    const fire = (r: number, c: number) => {
      if (targetGrid.hits[r][c]) return;
      const newHits = targetGrid.hits.map((row) => row.slice());
      newHits[r][c] = true;
      const ship = shipAt(targetGrid, r, c);
      const hit = ship !== null;
      const nextGrid: Grid = { ...targetGrid, hits: newHits };
      const nextGrids = [...grids];
      nextGrids[targetIdx] = nextGrid;
      setGrids(nextGrids);
      const sunkShip = ship && isSunk(nextGrid, ship) ? ship : null;
      const won = allSunk(nextGrid);
      setPhase({ kind: "turn-result", attackerIdx: pa.attackerIdx, hit, sunkShip, won, shot: [r, c] });
    };

    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{attacker.name} — aim</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Opponent&apos;s waters</p>
        <div className="mt-3">
          <PlayerGrid grid={targetGrid} showShips={false} onCellClick={fire} blockedOnMiss={true} />
        </div>
        <p className="mt-3 text-xs text-muted">Red = hit · Dark = miss. Tap an un-shot cell.</p>
      </section>
    );
  }

  // --- TURN RESULT ---------------------------------------------
  if (phase.kind === "turn-result") {
    const [r, c] = phase.shot;
    const coord = `${String.fromCharCode(65 + r)}${c + 1}`;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Shot {coord}</p>
        <h2 className={`mt-4 font-display text-5xl italic ${phase.hit ? "text-[hsl(var(--ember))]" : "text-muted"}`}>
          {phase.hit ? (phase.won ? "Victory." : phase.sunkShip ? "Sunk!" : "Hit.") : "Miss."}
        </h2>
        {phase.sunkShip && (
          <p className="mt-2 text-sm text-muted">You sank their {SHIP_NAMES[SHIP_LENGTHS.indexOf(phase.sunkShip.length)] ?? `length-${phase.sunkShip.length}`}.</p>
        )}
        <button
          type="button"
          onClick={() => {
            if (phase.won) setPhase({ kind: "end", winnerIdx: phase.attackerIdx });
            else setPhase({ kind: "turn-pass", attackerIdx: 1 - phase.attackerIdx });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {phase.won ? "See result →" : `Pass to ${players[1 - phase.attackerIdx].name} →`}
        </button>
      </section>
    );
  }

  // --- END -----------------------------------------------------
  const winner = players[phase.winnerIdx];
  function finishGame() {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: [winner.id],
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${winner.name} sank the fleet`],
    });
  }
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Victory</p>
      <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">{winner.name} wins.</h2>
      <p className="mt-4 text-sm text-muted">All enemy ships sunk.</p>
      <div className="mt-10 flex gap-3">
        <button type="button" onClick={finishGame} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Play again
        </button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
          Back
        </button>
      </div>
    </section>
  );
};

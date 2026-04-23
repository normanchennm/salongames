"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { DotsBoxesRemoteBoard } from "./RemoteBoard";

/** Dots and Boxes — 2-player, 5x5 dots (4x4 boxes by default).
 *
 *  Rule loop: on your turn you draw any un-drawn line. If your line
 *  completes a box's fourth side, you claim the box AND go again.
 *  Otherwise turn passes. Game ends when every line is drawn. Most
 *  boxes wins; ties are possible. */

const COLS = 4; // boxes wide
const ROWS = 4; // boxes tall
// Dots are (ROWS+1) × (COLS+1).

type Owner = "P1" | "P2" | null;

interface BoardState {
  // hLines[r][c] = line between dot (r,c) and (r,c+1). Dimensions: (ROWS+1) × COLS.
  hLines: Owner[][];
  // vLines[r][c] = line between dot (r,c) and (r+1,c). Dimensions: ROWS × (COLS+1).
  vLines: Owner[][];
  // boxes[r][c] claimed. Dimensions: ROWS × COLS.
  boxes: Owner[][];
}

function empty(): BoardState {
  return {
    hLines: Array.from({ length: ROWS + 1 }, () => Array<Owner>(COLS).fill(null)),
    vLines: Array.from({ length: ROWS }, () => Array<Owner>(COLS + 1).fill(null)),
    boxes: Array.from({ length: ROWS }, () => Array<Owner>(COLS).fill(null)),
  };
}

function boxComplete(b: BoardState, r: number, c: number): boolean {
  return !!(b.hLines[r][c] && b.hLines[r + 1][c] && b.vLines[r][c] && b.vLines[r][c + 1]);
}

/** Play a line. Returns new board + whether the mover gets another turn. */
function playLine(b: BoardState, line: { kind: "h" | "v"; r: number; c: number }, owner: Owner): { board: BoardState; bonus: boolean } {
  const next: BoardState = {
    hLines: b.hLines.map((row) => row.slice()),
    vLines: b.vLines.map((row) => row.slice()),
    boxes: b.boxes.map((row) => row.slice()),
  };
  if (line.kind === "h") next.hLines[line.r][line.c] = owner;
  else next.vLines[line.r][line.c] = owner;

  let claimed = 0;
  // Check both boxes adjacent to this line.
  const toCheck: [number, number][] = [];
  if (line.kind === "h") {
    if (line.r > 0) toCheck.push([line.r - 1, line.c]);
    if (line.r < ROWS) toCheck.push([line.r, line.c]);
  } else {
    if (line.c > 0) toCheck.push([line.r, line.c - 1]);
    if (line.c < COLS) toCheck.push([line.r, line.c]);
  }
  for (const [br, bc] of toCheck) {
    if (next.boxes[br][bc] === null && boxComplete(next, br, bc)) {
      next.boxes[br][bc] = owner;
      claimed++;
    }
  }
  return { board: next, bonus: claimed > 0 };
}

function scores(b: BoardState): { P1: number; P2: number } {
  let P1 = 0, P2 = 0;
  for (const row of b.boxes) for (const c of row) {
    if (c === "P1") P1++;
    else if (c === "P2") P2++;
  }
  return { P1, P2 };
}

function allLinesDrawn(b: BoardState): boolean {
  for (const row of b.hLines) for (const l of row) if (l === null) return false;
  for (const row of b.vLines) for (const l of row) if (l === null) return false;
  return true;
}

export const DotsBoxesBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <DotsBoxesRemoteBoard {...props} remote={props.remote} />;
  return <DotsBoxesLocalBoard {...props} />;
};

const DotsBoxesLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [board, setBoard] = useState<BoardState>(() => empty());
  const [turn, setTurn] = useState<"P1" | "P2">("P1");
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

  const p1 = players[0];
  const p2 = players[1];
  const s = scores(board);
  const done = allLinesDrawn(board);

  function makeMove(kind: "h" | "v", r: number, c: number) {
    if (done) return;
    const existing = kind === "h" ? board.hLines[r][c] : board.vLines[r][c];
    if (existing !== null) return;
    const { board: next, bonus } = playLine(board, { kind, r, c }, turn);
    setBoard(next);
    if (!bonus) setTurn(turn === "P1" ? "P2" : "P1");
  }

  function finish() {
    let winnerIds: string[];
    if (s.P1 > s.P2) winnerIds = [p1.id];
    else if (s.P2 > s.P1) winnerIds = [p2.id];
    else winnerIds = players.map((p) => p.id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${p1.name} ${s.P1} — ${p2.name} ${s.P2}`],
    });
  }

  const lineColor = (o: Owner) =>
    o === "P1" ? "hsl(var(--ember))" : o === "P2" ? "#5a8fa8" : "rgba(255,255,255,0.08)";
  const boxColor = (o: Owner) =>
    o === "P1" ? "hsla(var(--ember) / 0.18)" : o === "P2" ? "rgba(90,143,168,0.22)" : "transparent";

  // SVG geometry
  const STEP = 70; // pixels between dots
  const DOT = 5;
  const PAD = 20;
  const W = COLS * STEP + PAD * 2;
  const H = ROWS * STEP + PAD * 2;

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>
          <span className="text-[hsl(var(--ember))]">{p1.name} {s.P1}</span> vs <span className="text-[#5a8fa8]">{p2.name} {s.P2}</span>
        </span>
        <span>{done ? "Game over" : `${turn === "P1" ? p1.name : p2.name}'s turn`}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full rounded-md border border-border bg-bg/40">
        {/* Filled boxes */}
        {board.boxes.flatMap((row, r) =>
          row.map((o, c) => (
            <rect
              key={`b-${r}-${c}`}
              x={PAD + c * STEP}
              y={PAD + r * STEP}
              width={STEP}
              height={STEP}
              fill={boxColor(o)}
            />
          )),
        )}

        {/* Horizontal lines (tap targets) */}
        {board.hLines.flatMap((row, r) =>
          row.map((o, c) => (
            <g key={`h-${r}-${c}`}>
              <line
                x1={PAD + c * STEP}
                y1={PAD + r * STEP}
                x2={PAD + (c + 1) * STEP}
                y2={PAD + r * STEP}
                stroke={lineColor(o)}
                strokeWidth={o ? 4 : 2}
                strokeLinecap="round"
              />
              {o === null && !done && (
                <rect
                  x={PAD + c * STEP + 6}
                  y={PAD + r * STEP - 10}
                  width={STEP - 12}
                  height={20}
                  fill="transparent"
                  onClick={() => makeMove("h", r, c)}
                  className="cursor-pointer"
                  pointerEvents="all"
                />
              )}
            </g>
          )),
        )}

        {/* Vertical lines */}
        {board.vLines.flatMap((row, r) =>
          row.map((o, c) => (
            <g key={`v-${r}-${c}`}>
              <line
                x1={PAD + c * STEP}
                y1={PAD + r * STEP}
                x2={PAD + c * STEP}
                y2={PAD + (r + 1) * STEP}
                stroke={lineColor(o)}
                strokeWidth={o ? 4 : 2}
                strokeLinecap="round"
              />
              {o === null && !done && (
                <rect
                  x={PAD + c * STEP - 10}
                  y={PAD + r * STEP + 6}
                  width={20}
                  height={STEP - 12}
                  fill="transparent"
                  onClick={() => makeMove("v", r, c)}
                  className="cursor-pointer"
                  pointerEvents="all"
                />
              )}
            </g>
          )),
        )}

        {/* Dots */}
        {Array.from({ length: ROWS + 1 }).flatMap((_, r) =>
          Array.from({ length: COLS + 1 }).map((_, c) => (
            <circle key={`d-${r}-${c}`} cx={PAD + c * STEP} cy={PAD + r * STEP} r={DOT} fill="currentColor" className="text-fg" />
          )),
        )}

        {/* Box initials */}
        {board.boxes.flatMap((row, r) =>
          row.map((o, c) =>
            o ? (
              <text
                key={`t-${r}-${c}`}
                x={PAD + c * STEP + STEP / 2}
                y={PAD + r * STEP + STEP / 2 + 7}
                textAnchor="middle"
                className="font-display italic"
                fontSize="24"
                fill={o === "P1" ? "hsl(var(--ember))" : "#5a8fa8"}
              >
                {(o === "P1" ? p1.name : p2.name).slice(0, 1).toUpperCase()}
              </text>
            ) : null,
          ),
        )}
      </svg>

      {done && (
        <div className="mt-6 text-center">
          <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
            {s.P1 > s.P2 ? `${p1.name} wins.` : s.P2 > s.P1 ? `${p2.name} wins.` : "Draw."}
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

      {!done && (
        <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
          Quit
        </button>
      )}
    </section>
  );
};

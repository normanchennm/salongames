"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";

/** Nine Men's Morris — 2-player, 24 positions.
 *
 *  Phase 1: placement (alternating, 9 pieces each).
 *  Phase 2: movement (slide along edges to adjacent empty spot).
 *  Phase 3: flying (once a side has 3 pieces, they can jump anywhere).
 *
 *  Forming a mill (3 in a row on any line) → capture one opponent
 *  piece (preferring those not in mills). Lose when you drop below
 *  3 pieces or have no legal move. */

type Player = "A" | "B";
type Board = (Player | null)[];

// 24 positions, laid out for SVG rendering at these board coordinates.
// Indexing: outer ring 0-7, middle ring 8-15, inner ring 16-23.
// Each ring goes clockwise from top-left.
const POSITIONS: [number, number][] = [
  // Outer: 0-7
  [0, 0], [3, 0], [6, 0], [6, 3], [6, 6], [3, 6], [0, 6], [0, 3],
  // Middle: 8-15
  [1, 1], [3, 1], [5, 1], [5, 3], [5, 5], [3, 5], [1, 5], [1, 3],
  // Inner: 16-23
  [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [2, 3],
];

// Edges between positions (adjacency graph). Each pair is bidirectional.
const EDGES: [number, number][] = [
  // Outer ring
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
  // Middle ring
  [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 8],
  // Inner ring
  [16, 17], [17, 18], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [23, 16],
  // Radials (at ring mid-points on the four sides)
  [1, 9], [9, 17],     // top
  [15, 7], [23, 15],   // left -- careful: we connect outer mid-left (7) ↔ middle mid-left (15) ↔ inner mid-left (23)
  [3, 11], [11, 19],   // right
  [5, 13], [13, 21],   // bottom
];

// Build adjacency list.
const ADJ: number[][] = POSITIONS.map(() => []);
for (const [a, b] of EDGES) {
  ADJ[a].push(b);
  ADJ[b].push(a);
}

// All 16 mills (3 collinear, connected positions).
const MILLS: [number, number, number][] = [
  // Outer sides
  [0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0],
  // Middle sides
  [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 8],
  // Inner sides
  [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 16],
  // Radials
  [1, 9, 17], [7, 15, 23], [3, 11, 19], [5, 13, 21],
];

function millsContaining(pos: number): [number, number, number][] {
  return MILLS.filter((m) => m.includes(pos));
}

function inMill(board: Board, pos: number, player: Player): boolean {
  return millsContaining(pos).some((m) => m.every((p) => board[p] === player));
}

function countPieces(board: Board, player: Player): number {
  return board.filter((c) => c === player).length;
}

function canMoveAnything(board: Board, player: Player, isFlying: boolean): boolean {
  if (isFlying) {
    return board.some((c) => c === null); // can always fly if any spot empty and you have pieces
  }
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== player) continue;
    if (ADJ[i].some((j) => board[j] === null)) return true;
  }
  return false;
}

type Phase = "place" | "move" | "capture-after" | "end";

export const NineMensMorrisBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [board, setBoard] = useState<Board>(() => Array<Player | null>(24).fill(null));
  const [turn, setTurn] = useState<Player>("A");
  const [placed, setPlaced] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("place");
  const [pendingCapture, setPendingCapture] = useState(false);
  useScrollToTop(turn + phase);

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
  const aPieces = countPieces(board, "A");
  const bPieces = countPieces(board, "B");
  const aFlying = placed.A === 9 && aPieces === 3;
  const bFlying = placed.B === 9 && bPieces === 3;
  const turnFlying = turn === "A" ? aFlying : bFlying;

  // Endgame detection.
  const canContinue = () => {
    if (placed.A < 9 || placed.B < 9) return true;
    if (aPieces < 3 || bPieces < 3) return false;
    if (!canMoveAnything(board, "A", aFlying) && turn === "A") return false;
    if (!canMoveAnything(board, "B", bFlying) && turn === "B") return false;
    return true;
  };
  const gameOver = !canContinue();

  function handleClick(i: number) {
    if (gameOver) return;
    if (pendingCapture) {
      // Player must pick an opponent piece to remove.
      const opp: Player = turn === "A" ? "B" : "A";
      if (board[i] !== opp) return;
      // Prefer non-mill pieces; allow mill ones only if ALL are in mills.
      const oppPositions = board.map((c, k) => c === opp ? k : -1).filter((k) => k >= 0);
      const nonMill = oppPositions.filter((k) => !inMill(board, k, opp));
      if (nonMill.length > 0 && inMill(board, i, opp)) return;
      const nextBoard = board.slice();
      nextBoard[i] = null;
      setBoard(nextBoard);
      setPendingCapture(false);
      // Advance turn + phase.
      const nextTurn: Player = turn === "A" ? "B" : "A";
      setTurn(nextTurn);
      const bothPlaced = placed.A === 9 && placed.B === 9;
      setPhase(bothPlaced ? "move" : "place");
      setSelected(null);
      return;
    }

    if (phase === "place") {
      if (board[i] !== null) return;
      const nextBoard = board.slice();
      nextBoard[i] = turn;
      setBoard(nextBoard);
      const nextPlaced = { ...placed, [turn]: placed[turn] + 1 };
      setPlaced(nextPlaced);
      // Check mill formed by this placement.
      if (inMill(nextBoard, i, turn)) {
        setPendingCapture(true);
        return;
      }
      // Advance turn.
      const nextTurn: Player = turn === "A" ? "B" : "A";
      setTurn(nextTurn);
      const bothPlaced = nextPlaced.A === 9 && nextPlaced.B === 9;
      if (bothPlaced) setPhase("move");
    } else if (phase === "move") {
      if (selected === null) {
        if (board[i] !== turn) return;
        setSelected(i);
      } else {
        if (i === selected) { setSelected(null); return; }
        if (board[i] !== null) return;
        const validDest = turnFlying || ADJ[selected].includes(i);
        if (!validDest) return;
        const nextBoard = board.slice();
        nextBoard[i] = turn;
        nextBoard[selected] = null;
        setBoard(nextBoard);
        const formedMill = inMill(nextBoard, i, turn);
        setSelected(null);
        if (formedMill) {
          setPendingCapture(true);
          return;
        }
        const nextTurn: Player = turn === "A" ? "B" : "A";
        setTurn(nextTurn);
      }
    }
  }

  function finish() {
    let winnerIdx: number;
    if (aPieces < 3 || (!canMoveAnything(board, "A", aFlying) && turn === "A")) winnerIdx = 1;
    else if (bPieces < 3 || (!canMoveAnything(board, "B", bFlying) && turn === "B")) winnerIdx = 0;
    else winnerIdx = 0;
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: [players[winnerIdx].id],
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${players[winnerIdx].name} wins Nine Men's Morris`],
    });
  }

  // --- SVG rendering ---
  const STEP = 50, PAD = 30, SIZE = 6 * STEP + PAD * 2;
  const px = (x: number) => PAD + x * STEP;

  const oppName = turn === "A" ? aPlayer.name : bPlayer.name;

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>
          <span className="text-[hsl(var(--ember))]">{aPlayer.name}</span> {aPieces} (to place: {9 - placed.A}) ·
          {" "}{bPlayer.name} {bPieces} (to place: {9 - placed.B})
        </span>
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
        {gameOver ? "Game over" : pendingCapture ? `${oppName} — remove an opponent piece` : phase === "place" ? `${oppName} to place` : `${oppName} to move${turnFlying ? " (flying)" : ""}`}
      </p>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mt-3 w-full rounded-md border border-border bg-bg/40">
        {/* rings */}
        {[[0,1,2,3,4,5,6,7],[8,9,10,11,12,13,14,15],[16,17,18,19,20,21,22,23]].map((ring, ri) => (
          <rect key={ri} x={px(POSITIONS[ring[0]][0])} y={px(POSITIONS[ring[0]][1])} width={(POSITIONS[ring[4]][0] - POSITIONS[ring[0]][0]) * STEP} height={(POSITIONS[ring[4]][1] - POSITIONS[ring[0]][1]) * STEP} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted/70" />
        ))}
        {/* radials */}
        {[[1,9,17],[7,15,23],[3,11,19],[5,13,21]].map((line, li) => (
          <line key={li} x1={px(POSITIONS[line[0]][0])} y1={px(POSITIONS[line[0]][1])} x2={px(POSITIONS[line[2]][0])} y2={px(POSITIONS[line[2]][1])} stroke="currentColor" strokeWidth="1.5" className="text-muted/70" />
        ))}
        {/* points */}
        {POSITIONS.map((pos, i) => {
          const cell = board[i];
          const isSelected = selected === i;
          const canTap = !gameOver && (
            pendingCapture ? cell === (turn === "A" ? "B" : "A") :
            phase === "place" ? cell === null :
            phase === "move" ? (selected === null ? cell === turn : cell === null && (turnFlying || ADJ[selected].includes(i)) || i === selected) : false
          );
          return (
            <g key={i}>
              <circle cx={px(pos[0])} cy={px(pos[1])} r={14} fill="#1a1008" stroke={isSelected ? "hsl(var(--ember))" : "rgba(255,255,255,0.15)"} strokeWidth={isSelected ? 3 : 1} />
              {cell && (
                <circle cx={px(pos[0])} cy={px(pos[1])} r={11} fill={cell === "A" ? "hsl(var(--ember))" : "#5a8fa8"} />
              )}
              {canTap && (
                <circle cx={px(pos[0])} cy={px(pos[1])} r={18} fill="transparent" className="cursor-pointer" pointerEvents="all" onClick={() => handleClick(i)} />
              )}
            </g>
          );
        })}
      </svg>

      {gameOver && (
        <div className="mt-6 text-center">
          <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
            {aPieces < 3 || !canMoveAnything(board, "A", aFlying) ? `${bPlayer.name} wins.` : `${aPlayer.name} wins.`}
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

      {!gameOver && (
        <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
          Quit
        </button>
      )}
    </section>
  );
};

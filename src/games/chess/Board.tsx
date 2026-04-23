"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { ChessRemoteBoard } from "./RemoteBoard";

/** Chess — full-rule implementation.
 *
 *  Covers: all piece movements, castling (both sides, with check-through
 *  verification), en passant, pawn promotion (auto-queen), check /
 *  checkmate / stalemate detection, insufficient-material heuristic
 *  skipped, threefold / 50-move deferred. */

type PieceType = "P" | "R" | "N" | "B" | "Q" | "K";
type Color = "w" | "b";
interface Piece { color: Color; type: PieceType; hasMoved?: boolean; }
type Grid = (Piece | null)[][];

interface State {
  grid: Grid;
  turn: Color;
  enPassant: [number, number] | null; // target square for capture
  halfmoveClock: number; // half-moves since last pawn move or capture
}

function startGrid(): Grid {
  const g: Grid = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  const back: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    g[0][c] = { color: "b", type: back[c] };
    g[1][c] = { color: "b", type: "P" };
    g[6][c] = { color: "w", type: "P" };
    g[7][c] = { color: "w", type: back[c] };
  }
  return g;
}

function inBounds(r: number, c: number): boolean { return r >= 0 && r < 8 && c >= 0 && c < 8; }

/** Moves ignoring self-check. Includes castling, en passant. */
function pseudoMoves(state: State, r: number, c: number): [number, number][] {
  const p = state.grid[r][c];
  if (!p) return [];
  const moves: [number, number][] = [];
  const add = (nr: number, nc: number): boolean => {
    if (!inBounds(nr, nc)) return false;
    const t = state.grid[nr][nc];
    if (!t) { moves.push([nr, nc]); return true; }
    if (t.color !== p.color) moves.push([nr, nc]);
    return false;
  };
  const slide = (drs: [number, number][]) => {
    for (const [dr, dc] of drs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const t = state.grid[nr][nc];
        if (!t) moves.push([nr, nc]);
        else { if (t.color !== p.color) moves.push([nr, nc]); break; }
        nr += dr; nc += dc;
      }
    }
  };
  switch (p.type) {
    case "P": {
      const dir = p.color === "w" ? -1 : 1;
      const startRow = p.color === "w" ? 6 : 1;
      // forward
      if (inBounds(r + dir, c) && !state.grid[r + dir][c]) {
        moves.push([r + dir, c]);
        if (r === startRow && !state.grid[r + 2 * dir][c]) moves.push([r + 2 * dir, c]);
      }
      // diagonal capture
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const t = state.grid[nr][nc];
        if (t && t.color !== p.color) moves.push([nr, nc]);
        // en passant
        if (state.enPassant && state.enPassant[0] === nr && state.enPassant[1] === nc) moves.push([nr, nc]);
      }
      break;
    }
    case "R": slide([[-1,0],[1,0],[0,-1],[0,1]]); break;
    case "B": slide([[-1,-1],[-1,1],[1,-1],[1,1]]); break;
    case "Q": slide([[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]); break;
    case "N": {
      const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of jumps) add(r + dr, c + dc);
      break;
    }
    case "K": {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr || dc) add(r + dr, c + dc);
      // Castling
      if (!p.hasMoved) {
        // Kingside
        const rank = p.color === "w" ? 7 : 0;
        const rookK = state.grid[rank][7];
        if (rookK && rookK.type === "R" && rookK.color === p.color && !rookK.hasMoved && !state.grid[rank][5] && !state.grid[rank][6]) {
          if (!isSquareAttacked(state, rank, 4, p.color === "w" ? "b" : "w") &&
              !isSquareAttacked(state, rank, 5, p.color === "w" ? "b" : "w") &&
              !isSquareAttacked(state, rank, 6, p.color === "w" ? "b" : "w")) {
            moves.push([rank, 6]);
          }
        }
        // Queenside
        const rookQ = state.grid[rank][0];
        if (rookQ && rookQ.type === "R" && rookQ.color === p.color && !rookQ.hasMoved && !state.grid[rank][1] && !state.grid[rank][2] && !state.grid[rank][3]) {
          if (!isSquareAttacked(state, rank, 4, p.color === "w" ? "b" : "w") &&
              !isSquareAttacked(state, rank, 3, p.color === "w" ? "b" : "w") &&
              !isSquareAttacked(state, rank, 2, p.color === "w" ? "b" : "w")) {
            moves.push([rank, 2]);
          }
        }
      }
      break;
    }
  }
  return moves;
}

function isSquareAttacked(state: State, r: number, c: number, byColor: Color): boolean {
  // Check every piece of byColor; generate their pseudo-moves (without castling recursion) and see if any lands on (r,c).
  for (let sr = 0; sr < 8; sr++) {
    for (let sc = 0; sc < 8; sc++) {
      const p = state.grid[sr][sc];
      if (!p || p.color !== byColor) continue;
      // For attack check, ignore castling destinations (pieces don't attack via castling).
      const moves = attackMoves(state, sr, sc);
      if (moves.some(([mr, mc]) => mr === r && mc === c)) return true;
    }
  }
  return false;
}

function attackMoves(state: State, r: number, c: number): [number, number][] {
  const p = state.grid[r][c];
  if (!p) return [];
  const moves: [number, number][] = [];
  const add = (nr: number, nc: number): boolean => {
    if (!inBounds(nr, nc)) return false;
    const t = state.grid[nr][nc];
    if (!t) { moves.push([nr, nc]); return true; }
    if (t.color !== p.color) moves.push([nr, nc]);
    return false;
  };
  const slide = (drs: [number, number][]) => {
    for (const [dr, dc] of drs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const t = state.grid[nr][nc];
        if (!t) moves.push([nr, nc]);
        else { if (t.color !== p.color) moves.push([nr, nc]); break; }
        nr += dr; nc += dc;
      }
    }
  };
  switch (p.type) {
    case "P": {
      const dir = p.color === "w" ? -1 : 1;
      for (const dc of [-1, 1]) if (inBounds(r + dir, c + dc)) moves.push([r + dir, c + dc]);
      break;
    }
    case "R": slide([[-1,0],[1,0],[0,-1],[0,1]]); break;
    case "B": slide([[-1,-1],[-1,1],[1,-1],[1,1]]); break;
    case "Q": slide([[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]); break;
    case "N": {
      const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of jumps) add(r + dr, c + dc);
      break;
    }
    case "K": {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr || dc) add(r + dr, c + dc);
      break;
    }
  }
  return moves;
}

function applyMove(state: State, from: [number, number], to: [number, number]): State {
  const next: State = { grid: state.grid.map((row) => row.slice()), turn: state.turn === "w" ? "b" : "w", enPassant: null, halfmoveClock: state.halfmoveClock + 1 };
  const [fr, fc] = from, [tr, tc] = to;
  const piece = next.grid[fr][fc];
  if (!piece) return next;
  const moved: Piece = { ...piece, hasMoved: true };
  const captureTarget = state.grid[tr][tc];
  next.grid[fr][fc] = null;

  // Reset the halfmove clock on pawn move or capture. The 50-move
  // rule counts half-moves since one of those happened.
  if (piece.type === "P") next.halfmoveClock = 0;
  if (captureTarget) next.halfmoveClock = 0;

  // En passant capture
  if (piece.type === "P" && state.enPassant && tr === state.enPassant[0] && tc === state.enPassant[1] && fc !== tc) {
    // Remove captured pawn.
    next.grid[fr][tc] = null;
    next.halfmoveClock = 0;
  }
  // Pawn double-step sets enPassant target.
  if (piece.type === "P" && Math.abs(tr - fr) === 2) {
    next.enPassant = [(fr + tr) / 2, fc];
  }
  // Pawn promotion → queen
  if (piece.type === "P" && (tr === 0 || tr === 7)) {
    moved.type = "Q";
  }
  // Castling: if king moved 2 squares, move the rook too.
  if (piece.type === "K" && Math.abs(tc - fc) === 2) {
    if (tc === 6) {
      const rook = next.grid[fr][7];
      next.grid[fr][7] = null;
      next.grid[fr][5] = rook ? { ...rook, hasMoved: true } : null;
    } else if (tc === 2) {
      const rook = next.grid[fr][0];
      next.grid[fr][0] = null;
      next.grid[fr][3] = rook ? { ...rook, hasMoved: true } : null;
    }
  }
  next.grid[tr][tc] = moved;
  return next;
}

function isInCheck(state: State, color: Color): boolean {
  // Find king.
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.grid[r][c];
      if (p && p.color === color && p.type === "K") {
        return isSquareAttacked(state, r, c, color === "w" ? "b" : "w");
      }
    }
  }
  return false;
}

function legalMoves(state: State, r: number, c: number): [number, number][] {
  const p = state.grid[r][c];
  if (!p || p.color !== state.turn) return [];
  const pseudo = pseudoMoves(state, r, c);
  return pseudo.filter(([tr, tc]) => {
    const next = applyMove(state, [r, c], [tr, tc]);
    // After our move, we must not be in check.
    return !isInCheck({ ...next, turn: p.color }, p.color);
  });
}

function anyLegalMoves(state: State): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.grid[r][c];
      if (!p || p.color !== state.turn) continue;
      if (legalMoves(state, r, c).length > 0) return true;
    }
  }
  return false;
}

const PIECE_SYMBOLS: Record<string, string> = {
  "wP": "♙", "wR": "♖", "wN": "♘", "wB": "♗", "wQ": "♕", "wK": "♔",
  "bP": "♟", "bR": "♜", "bN": "♞", "bB": "♝", "bQ": "♛", "bK": "♚",
};

/** Insufficient material: K vs K, K+minor vs K, K+B vs K+B with the
 *  bishops on the same colour. Any pawn / rook / queen still on the
 *  board rules out the draw. */
function isInsufficientMaterial(state: State): boolean {
  const pieces: Array<{ type: PieceType; square: number }> = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.grid[r][c];
      if (!p) continue;
      pieces.push({ type: p.type, square: (r + c) % 2 });
    }
  }
  if (pieces.some((p) => p.type === "P" || p.type === "R" || p.type === "Q")) return false;
  const minors = pieces.filter((p) => p.type === "B" || p.type === "N");
  if (minors.length === 0) return true;
  if (minors.length === 1) return true;
  if (minors.length === 2 && minors.every((p) => p.type === "B")) {
    return minors[0].square === minors[1].square;
  }
  return false;
}

export const ChessBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <ChessRemoteBoard {...props} remote={props.remote} />;
  return <ChessLocalBoard {...props} />;
};

const ChessLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [state, setState] = useState<State>(() => ({ grid: startGrid(), turn: "w", enPassant: null, halfmoveClock: 0 }));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  useScrollToTop(state.turn);

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  const wPlayer = players[0];
  const bPlayer = players[1];
  const inCheck = isInCheck(state, state.turn);
  const hasMoves = anyLegalMoves(state);
  const fiftyMoveDraw = state.halfmoveClock >= 100;
  const insufficientMaterialDraw = isInsufficientMaterial(state);
  const over = !hasMoves || fiftyMoveDraw || insufficientMaterialDraw;
  // Winner index is only set on checkmate. Stalemate / 50-move /
  // insufficient material all resolve to no winner (draw, all-share).
  const winnerIdx = over && !hasMoves && inCheck ? (state.turn === "w" ? 1 : 0) : -1;
  const endReason: "checkmate" | "stalemate" | "fifty-move" | "insufficient-material" | null = !over
    ? null
    : !hasMoves
      ? inCheck ? "checkmate" : "stalemate"
      : fiftyMoveDraw
        ? "fifty-move"
        : "insufficient-material";

  const targets: Set<string> = new Set(
    selected ? legalMoves(state, selected[0], selected[1]).map(([r, c]) => `${r},${c}`) : [],
  );

  const click = (r: number, c: number) => {
    if (over) return;
    const key = `${r},${c}`;
    if (selected && targets.has(key)) {
      const next = applyMove(state, selected, [r, c]);
      setState(next);
      setSelected(null);
      return;
    }
    const p = state.grid[r][c];
    if (p && p.color === state.turn) setSelected([r, c]);
    else setSelected(null);
  };

  const endLabel = (() => {
    switch (endReason) {
      case "checkmate": return "Checkmate";
      case "stalemate": return "Stalemate";
      case "fifty-move": return "Draw · 50-move";
      case "insufficient-material": return "Draw · insufficient material";
      default: return "";
    }
  })();

  const finish = () => {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: winnerIdx >= 0 ? [players[winnerIdx].id] : players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [endLabel || "Game ended"],
    });
  };

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>
          <span className="text-fg">{wPlayer.name}</span> vs <span className="text-fg">{bPlayer.name}</span>
        </span>
        <span className={state.turn === "w" ? "" : "text-[hsl(var(--ember))]"}>
          {over ? endLabel : `${state.turn === "w" ? wPlayer.name : bPlayer.name}'s turn${inCheck ? " (check)" : ""}`}
        </span>
      </div>

      <div className="mt-3 grid gap-0 rounded-md border border-border" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
        {state.grid.flatMap((row, r) =>
          row.map((cell, c) => {
            const dark = (r + c) % 2 === 1;
            const isSelected = selected && selected[0] === r && selected[1] === c;
            const isTarget = targets.has(`${r},${c}`);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => click(r, c)}
                disabled={over}
                className={`flex aspect-square items-center justify-center text-3xl ${
                  dark ? "bg-[#8a7050]" : "bg-[#f5efe4]"
                } ${isSelected ? "ring-2 ring-inset ring-[hsl(var(--ember))]" : ""} ${isTarget ? "ring-2 ring-inset ring-[hsl(var(--ember)/0.6)]" : ""}`}
              >
                {cell && (
                  <span className={cell.color === "w" ? "text-[#1a1008]" : "text-[#1a1008]"}>
                    {PIECE_SYMBOLS[cell.color + cell.type]}
                  </span>
                )}
                {!cell && isTarget && <div className="h-2 w-2 rounded-full bg-[hsl(var(--ember)/0.7)]" />}
              </button>
            );
          }),
        )}
      </div>

      {over && (
        <div className="mt-6 text-center">
          <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
            {endReason === "checkmate" && winnerIdx >= 0
              ? `${players[winnerIdx].name} wins.`
              : "Draw."}
          </h2>
          {endReason && endReason !== "checkmate" && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
              {endLabel}
            </p>
          )}
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={finish} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">Play again</button>
            <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
          </div>
        </div>
      )}

      {!over && (
        <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      )}
    </section>
  );
};

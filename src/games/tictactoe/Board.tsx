"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { TicTacToeRemoteBoard } from "./RemoteBoard";

/** Tic-Tac-Toe — 2 players, one board, strict turn-taking. Persisted
 *  in component state only; no history, no undo. */

type Cell = "X" | "O" | null;
type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

const WINNING_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],   // cols
  [0, 4, 8], [2, 4, 6],              // diagonals
];

function detectWin(b: Board): { line: [number, number, number]; mark: "X" | "O" } | null {
  for (const line of WINNING_LINES) {
    const [a, b2, c] = line;
    if (b[a] && b[a] === b[b2] && b[a] === b[c]) {
      return { line, mark: b[a]! };
    }
  }
  return null;
}

export const TicTacToeBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <TicTacToeRemoteBoard {...props} remote={props.remote} />;
  return <TicTacToeLocalBoard {...props} />;
};

const TicTacToeLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [board, setBoard] = useState<Board>([null, null, null, null, null, null, null, null, null]);
  const [turn, setTurn] = useState<"X" | "O">("X");
  useScrollToTop(turn);

  if (players.length !== 2) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Two-player game</p>
        <h2 className="mt-2 font-display text-2xl italic">Pick exactly two players from the roster.</h2>
        <button
          type="button"
          onClick={onQuit}
          className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted"
        >
          Back
        </button>
      </section>
    );
  }

  const xPlayer = players[0];
  const oPlayer = players[1];
  const win = detectWin(board);
  const full = board.every((c) => c !== null);
  const over = win !== null || full;

  function finish(winner: "X" | "O" | "draw") {
    const winnerIds =
      winner === "draw"
        ? players.map((p) => p.id)
        : winner === "X"
          ? [xPlayer.id]
          : [oPlayer.id];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: winner === "draw" ? ["Cat's game"] : [`${winner === "X" ? xPlayer.name : oPlayer.name} wins`],
    });
  }

  function play(i: number) {
    if (over || board[i] !== null) return;
    const next = board.slice() as Board;
    next[i] = turn;
    setBoard(next);
    setTurn(turn === "X" ? "O" : "X");
  }

  const currentName = turn === "X" ? xPlayer.name : oPlayer.name;

  return (
    <section className="mx-auto max-w-sm animate-fade-up">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>{xPlayer.name} (X) vs {oPlayer.name} (O)</span>
        <span className={turn === "X" ? "text-[hsl(var(--ember))]" : "text-muted"}>
          {over ? "Game over" : `${currentName}'s turn`}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {board.map((cell, i) => {
          const isWinCell = win?.line.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => play(i)}
              disabled={over || cell !== null}
              className={`flex aspect-square items-center justify-center rounded-md border text-5xl transition-colors ${
                isWinCell
                  ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)]"
                  : "border-border bg-bg/40 hover:border-[hsl(var(--ember)/0.4)]"
              }`}
            >
              <span className={`font-display italic ${cell === "X" ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
                {cell ?? ""}
              </span>
            </button>
          );
        })}
      </div>

      {over && (
        <div className="mt-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Result</p>
          <h2 className="mt-1 font-display text-3xl italic text-[hsl(var(--ember))]">
            {win ? `${win.mark === "X" ? xPlayer.name : oPlayer.name} wins` : "Cat's game"}
          </h2>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => finish(win ? win.mark : "draw")}
              className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={onQuit}
              className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {!over && (
        <button
          type="button"
          onClick={onQuit}
          className="mt-8 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          Quit
        </button>
      )}
    </section>
  );
};

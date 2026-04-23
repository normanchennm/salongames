"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  isInCheck,
  legalMoves,
  type ChessRemoteState,
  type ChessRemoteAction,
} from "./remote";

const PIECE_SYMBOLS: Record<string, string> = {
  wP: "♙", wR: "♖", wN: "♘", wB: "♗", wQ: "♕", wK: "♔",
  bP: "♟", bR: "♜", bN: "♞", bB: "♝", bQ: "♛", bK: "♚",
};

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const ChessRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as ChessRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: ChessRemoteAction) => void;
  const completedRef = useRef(false);

  const [selected, setSelected] = useState<[number, number] | null>(null);

  useScrollToTop(state ? state.kind + state.core.turn : "loading");

  // Clear selection when turn changes.
  useEffect(() => {
    setSelected(null);
  }, [state?.core.turn]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const [wId, bId] = state.playerOrder;
    const winnerIds =
      state.winner === "draw" ? state.playerOrder : state.winner === "w" ? [wId] : [bId];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [
        state.reason === "checkmate"
          ? "Checkmate"
          : state.reason === "stalemate"
            ? "Stalemate"
            : state.reason === "fifty-move"
              ? "Draw — 50-move rule"
              : state.reason === "insufficient-material"
                ? "Draw — insufficient material"
                : "Draw",
      ],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Setting up pieces…</p>
      </section>
    );
  }

  const findName = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const [wId, bId] = state.playerOrder;
  const myIdx = state.playerOrder.indexOf(me);
  const mySeat: "w" | "b" | null = myIdx === 0 ? "w" : myIdx === 1 ? "b" : null;
  const myTurn = mySeat !== null && mySeat === state.core.turn && state.kind === "playing";
  const inCheck = isInCheck(state.core, state.core.turn);
  const currentName = state.core.turn === "w" ? findName(wId) : findName(bId);

  const targets: Set<string> = new Set(
    myTurn && selected ? legalMoves(state.core, selected[0], selected[1]).map(([r, c]) => `${r},${c}`) : [],
  );

  function click(r: number, c: number) {
    if (!myTurn) return;
    const key = `${r},${c}`;
    if (selected && targets.has(key)) {
      dispatch({ type: "move", from: selected, to: [r, c] });
      setSelected(null);
      return;
    }
    const p = state!.core.grid[r][c];
    if (p && p.color === state!.core.turn && p.color === mySeat) setSelected([r, c]);
    else setSelected(null);
  }

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>
            <span className="text-fg">{findName(wId)}</span> vs <span className="text-fg">{findName(bId)}</span>
          </span>
          <span className={state.core.turn === "w" ? "" : "text-[hsl(var(--ember))]"}>
            {state.kind === "end"
              ? state.reason === "checkmate"
                ? "Checkmate"
                : state.reason === "stalemate"
                  ? "Stalemate"
                  : state.reason === "fifty-move"
                    ? "Draw · 50-move"
                    : state.reason === "insufficient-material"
                      ? "Draw · insufficient material"
                      : "Draw"
              : myTurn
                ? `Your turn${inCheck ? " (check)" : ""}`
                : `${currentName}'s turn${inCheck ? " (check)" : ""}`}
          </span>
        </div>

        <div
          className="mt-3 grid gap-0 rounded-md border border-border"
          style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}
        >
          {state.core.grid.flatMap((row, r) =>
            row.map((cell, c) => {
              const dark = (r + c) % 2 === 1;
              const isSel = selected && selected[0] === r && selected[1] === c;
              const isTarget = targets.has(`${r},${c}`);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => click(r, c)}
                  disabled={!myTurn || state.kind === "end"}
                  className={`flex aspect-square items-center justify-center text-3xl ${
                    dark ? "bg-[#8a7050]" : "bg-[#f5efe4]"
                  } ${isSel ? "ring-2 ring-inset ring-[hsl(var(--ember))]" : ""} ${isTarget ? "ring-2 ring-inset ring-[hsl(var(--ember)/0.6)]" : ""}`}
                >
                  {cell && <span className="text-[#1a1008]">{PIECE_SYMBOLS[cell.color + cell.type]}</span>}
                  {!cell && isTarget && <div className="h-2 w-2 rounded-full bg-[hsl(var(--ember)/0.7)]" />}
                </button>
              );
            }),
          )}
        </div>

        {state.kind === "end" && (
          <div className="mt-6 text-center">
            <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
              {state.winner === "draw"
                ? "Draw."
                : `${state.winner === "w" ? findName(wId) : findName(bId)} wins.`}
            </h2>
            <div className="mt-6 flex gap-3">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => { completedRef.current = false; dispatch({ type: "rematch" }); }}
                  className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
                >
                  Rematch
                </button>
              ) : (
                <p className="flex-1 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-xs text-muted">Waiting for host…</p>
              )}
              <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">
                Leave room
              </button>
            </div>
          </div>
        )}

        {state.kind === "playing" && (
          <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
            Leave room
          </button>
        )}
      </section>
    </RoomCodeBar>
  );
};

function RoomCodeBar({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-md items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">room</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">{code}</span>
      </div>
      {children}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { COLS, type C4RemoteState, type C4RemoteAction } from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const Connect4RemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as C4RemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: C4RemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + state.turn : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const [rId, yId] = state.playerOrder;
    const winnerIds =
      state.winner === "draw" ? state.playerOrder : state.winner === "R" ? [rId] : [yId];
    const rName = players.find((p) => p.id === rId)?.name ?? "?";
    const yName = players.find((p) => p.id === yId)?.name ?? "?";
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: state.winner === "draw" ? ["Stalemate"] : [`${state.winner === "R" ? rName : yName} connects four`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Setting up board…</p>
      </section>
    );
  }

  const findName = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const [rId, yId] = state.playerOrder;
  const myIdx = state.playerOrder.indexOf(me);
  const mySeat: "R" | "Y" | null = myIdx === 0 ? "R" : myIdx === 1 ? "Y" : null;
  const myTurn = mySeat !== null && mySeat === state.turn && state.kind === "playing";
  const currentName = state.turn === "R" ? findName(rId) : findName(yId);
  const winCells = new Set(state.winLine?.map(([r, c]) => `${r},${c}`) ?? []);

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>
            <span className="text-[hsl(var(--ember))]">{findName(rId)}</span> vs {findName(yId)}
          </span>
          <span>
            {state.kind === "end" ? "Game over" : myTurn ? "Your turn" : `${currentName}'s turn`}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {Array.from({ length: COLS }, (_, c) => {
            const colFull = state.grid[0][c] !== null;
            const canDrop = myTurn && !colFull;
            return (
              <button
                key={c}
                type="button"
                onClick={() => dispatch({ type: "play", col: c })}
                disabled={!canDrop}
                aria-label={`Drop in column ${c + 1}`}
                className={`flex aspect-square items-center justify-center rounded-md border text-xs transition-colors ${
                  canDrop
                    ? "border-border hover:border-[hsl(var(--ember)/0.5)] hover:bg-[hsl(var(--ember)/0.05)]"
                    : "border-border/60 text-muted/40"
                } ${state.turn === "R" ? "text-[hsl(var(--ember))]" : "text-[#f2c94c]"}`}
              >
                ↓
              </button>
            );
          })}
        </div>

        <div
          className="mt-2 grid gap-1 rounded-md border border-border bg-bg/40 p-2"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {state.grid.flatMap((row, r) =>
            row.map((cell, c) => {
              const highlight = winCells.has(`${r},${c}`);
              return (
                <div
                  key={`${r}-${c}`}
                  className={`flex aspect-square items-center justify-center rounded-full border ${
                    highlight ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)]" : "border-border/60 bg-bg"
                  }`}
                >
                  {cell === "R" && <div className="h-4/5 w-4/5 rounded-full bg-[hsl(var(--ember))]" />}
                  {cell === "Y" && <div className="h-4/5 w-4/5 rounded-full bg-[#f2c94c]" />}
                </div>
              );
            }),
          )}
        </div>

        {state.kind === "end" && (
          <div className="mt-6 text-center">
            <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
              {state.winner === "draw"
                ? "Stalemate"
                : `${state.winner === "R" ? findName(rId) : findName(yId)} wins`}
            </h2>
            <div className="mt-6 flex gap-3">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    completedRef.current = false;
                    dispatch({ type: "rematch" });
                  }}
                  className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
                >
                  Rematch
                </button>
              ) : (
                <p className="flex-1 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-xs text-muted">Waiting for host…</p>
              )}
              <button
                type="button"
                onClick={onQuit}
                className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted"
              >
                Leave
              </button>
            </div>
          </div>
        )}

        {state.kind === "playing" && (
          <button
            type="button"
            onClick={onQuit}
            className="mt-6 block w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
          >
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

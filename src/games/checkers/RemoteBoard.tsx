"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  SIZE,
  countPieces,
  simpleMoves,
  jumpMoves,
  type CheckersRemoteState,
  type CheckersRemoteAction,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const CheckersRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as CheckersRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: CheckersRemoteAction) => void;
  const completedRef = useRef(false);

  const [localSelected, setLocalSelected] = useState<[number, number] | null>(null);

  useScrollToTop(state ? state.kind + state.turn : "loading");

  // If chain started, auto-select the chain piece (it's locked).
  useEffect(() => {
    if (state?.chainFrom) setLocalSelected(state.chainFrom);
  }, [state?.chainFrom]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const [dId, lId] = state.playerOrder;
    const { dark, light } = countPieces(state.grid);
    const dName = players.find((p) => p.id === dId)?.name ?? "?";
    const lName = players.find((p) => p.id === lId)?.name ?? "?";
    const winnerIds = state.winner === "draw" ? state.playerOrder : state.winner === "dark" ? [dId] : [lId];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${dName} ${dark} pcs — ${lName} ${light} pcs`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Setting up board…</p>
      </section>
    );
  }

  const findName = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const [dId, lId] = state.playerOrder;
  const myIdx = state.playerOrder.indexOf(me);
  const mySeat: "dark" | "light" | null = myIdx === 0 ? "dark" : myIdx === 1 ? "light" : null;
  const myTurn = mySeat !== null && mySeat === state.turn && state.kind === "playing";
  const counts = countPieces(state.grid);

  const selectedJumps = myTurn && localSelected ? jumpMoves(state.grid, localSelected[0], localSelected[1]) : [];
  const selectedSimples = myTurn && localSelected && !state.chainFrom ? simpleMoves(state.grid, localSelected[0], localSelected[1]) : [];
  const targets = new Set([
    ...selectedJumps.map((j) => `${j.to[0]},${j.to[1]}`),
    ...selectedSimples.map(([r, c]) => `${r},${c}`),
  ]);

  function onCellTap(r: number, c: number) {
    if (!myTurn) return;
    if (localSelected && targets.has(`${r},${c}`)) {
      dispatch({ type: "move", from: localSelected, to: [r, c] });
      // Don't clear selection here; if chain, host re-locks to jump.to via useEffect.
      setLocalSelected(null);
      return;
    }
    if (state!.chainFrom) return; // locked
    const cell = state!.grid[r][c];
    if (cell && cell.color === mySeat) setLocalSelected([r, c]);
  }

  const currentName = state.turn === "dark" ? findName(dId) : findName(lId);

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>
            <span className="text-[hsl(var(--ember))]">{findName(dId)}</span> {counts.dark} vs {findName(lId)} {counts.light}
          </span>
          <span>{state.kind === "end" ? "Game over" : myTurn ? "Your turn" : `${currentName}'s turn`}</span>
        </div>

        <div
          className="mt-4 grid gap-0 rounded-md border border-border bg-bg/40 p-1"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        >
          {state.grid.flatMap((row, r) =>
            row.map((cell, c) => {
              const isDark = (r + c) % 2 === 1;
              const isSel = localSelected && localSelected[0] === r && localSelected[1] === c;
              const isTarget = targets.has(`${r},${c}`);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => onCellTap(r, c)}
                  disabled={!myTurn || (!cell && !isTarget && !isSel)}
                  className={`flex aspect-square items-center justify-center ${
                    isDark ? "bg-[#3a2a1a]" : "bg-[#f5efe4]"
                  } ${isSel ? "ring-2 ring-inset ring-[hsl(var(--ember))]" : ""} ${isTarget ? "ring-2 ring-inset ring-[hsl(var(--ember)/0.6)]" : ""}`}
                >
                  {cell && (
                    <div
                      className={`flex h-4/5 w-4/5 items-center justify-center rounded-full border-2 ${
                        cell.color === "dark" ? "border-[#0a0705] bg-[#1a1008]" : "border-[#e0d4bc] bg-[#faf3e2]"
                      }`}
                    >
                      {cell.king && (
                        <span className={`font-display text-xs italic ${cell.color === "dark" ? "text-[hsl(var(--ember))]" : "text-[#c9a94c]"}`}>K</span>
                      )}
                    </div>
                  )}
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
                : `${state.winner === "dark" ? findName(dId) : findName(lId)} wins.`}
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
                Leave
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

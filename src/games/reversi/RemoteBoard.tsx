"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  SIZE,
  countDiscs,
  legalMoves,
  type ReversiRemoteState,
  type ReversiRemoteAction,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const ReversiRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as ReversiRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: ReversiRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + state.turn : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const [bId, wId] = state.playerOrder;
    const { B, W } = countDiscs(state.grid);
    const winnerIds =
      state.winner === "draw" ? state.playerOrder : state.winner === "B" ? [bId] : [wId];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`Black ${B} — White ${W}`],
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
  const [bId, wId] = state.playerOrder;
  const myIdx = state.playerOrder.indexOf(me);
  const mySeat: "B" | "W" | null = myIdx === 0 ? "B" : myIdx === 1 ? "W" : null;
  const myTurn = mySeat !== null && mySeat === state.turn && state.kind === "playing";
  const currentName = state.turn === "B" ? findName(bId) : findName(wId);
  const { B, W } = countDiscs(state.grid);
  const legal = state.kind === "playing" ? legalMoves(state.grid, state.turn) : new Set<string>();

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>
            {findName(bId)} ● {B} / {findName(wId)} ○ {W}
          </span>
          <span className={state.turn === "B" ? "text-fg" : "text-[hsl(var(--ember))]"}>
            {state.kind === "end" ? "Game over" : myTurn ? "Your turn" : `${currentName}'s turn`}
          </span>
        </div>

        <div
          className="mt-4 grid gap-0.5 rounded-md border border-border bg-[#1a3f1a] p-1"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        >
          {state.grid.flatMap((row, r) =>
            row.map((cell, c) => {
              const isLegal = myTurn && legal.has(`${r},${c}`);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => dispatch({ type: "play", r, c })}
                  disabled={!isLegal}
                  className="flex aspect-square items-center justify-center bg-[#1f4f1f] transition-colors hover:bg-[#2a5f2a] disabled:hover:bg-[#1f4f1f]"
                >
                  {cell === "B" && <div className="h-4/5 w-4/5 rounded-full bg-[#100d0b] shadow-inner" />}
                  {cell === "W" && <div className="h-4/5 w-4/5 rounded-full bg-[#f5efe4] shadow-inner" />}
                  {isLegal && cell === null && <div className="h-2 w-2 rounded-full bg-[hsl(var(--ember)/0.6)]" />}
                </button>
              );
            }),
          )}
        </div>

        {state.kind === "playing" && myTurn && legal.size === 0 && (
          <div className="mt-4 rounded-md border border-border bg-bg/40 p-3 text-center">
            <p className="font-mono text-xs text-muted">You have no legal moves.</p>
            <button
              type="button"
              onClick={() => dispatch({ type: "pass" })}
              className="mt-2 rounded-md bg-[hsl(var(--ember))] px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Pass turn
            </button>
          </div>
        )}

        {state.kind === "end" && (
          <div className="mt-6 text-center">
            <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
              {state.winner === "draw"
                ? "Draw."
                : `${state.winner === "B" ? findName(bId) : findName(wId)} wins.`}
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

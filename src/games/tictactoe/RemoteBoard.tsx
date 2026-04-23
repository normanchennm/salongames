"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { type TTTRemoteState, type TTTRemoteAction } from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const TicTacToeRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as TTTRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: TTTRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + state.turn : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const [xId, oId] = state.playerOrder;
    const winnerIds =
      state.winner === "draw"
        ? state.playerOrder
        : state.winner === "X"
          ? [xId]
          : [oId];
    const xName = players.find((p) => p.id === xId)?.name ?? "?";
    const oName = players.find((p) => p.id === oId)?.name ?? "?";
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: state.winner === "draw" ? ["Cat's game"] : [`${state.winner === "X" ? xName : oName} wins`],
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
  const [xId, oId] = state.playerOrder;
  const myIdx = state.playerOrder.indexOf(me);
  const mySeat: "X" | "O" | null = myIdx === 0 ? "X" : myIdx === 1 ? "O" : null;
  const myTurn = mySeat !== null && mySeat === state.turn && state.kind === "playing";

  if (myIdx < 0) {
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-sm animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Spectator</p>
          <p className="mt-3 text-sm text-muted">
            {findName(xId)} (X) vs {findName(oId)} (O). Watching.
          </p>
          <BoardView state={state} canTap={false} onTap={() => {}} />
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  const currentName = state.turn === "X" ? findName(xId) : findName(oId);

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-sm animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>
            {findName(xId)} (X) vs {findName(oId)} (O)
          </span>
          <span className={state.turn === "X" ? "text-[hsl(var(--ember))]" : "text-muted"}>
            {state.kind === "end" ? "Game over" : myTurn ? "Your turn" : `${currentName}'s turn`}
          </span>
        </div>

        <BoardView
          state={state}
          canTap={myTurn}
          onTap={(i) => dispatch({ type: "play", index: i })}
        />

        {state.kind === "end" && (
          <div className="mt-8 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Result</p>
            <h2 className="mt-1 font-display text-3xl italic text-[hsl(var(--ember))]">
              {state.winner === "draw"
                ? "Cat's game"
                : `${state.winner === "X" ? findName(xId) : findName(oId)} wins`}
            </h2>
            <div className="mt-6 flex gap-3">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    completedRef.current = false;
                    dispatch({ type: "rematch" });
                  }}
                  className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
                >
                  Rematch
                </button>
              ) : (
                <p className="flex-1 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-xs text-muted">
                  Waiting for host…
                </p>
              )}
              <button
                type="button"
                onClick={onQuit}
                className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
              >
                Leave
              </button>
            </div>
          </div>
        )}

        {state.kind === "playing" && <QuitButton onQuit={onQuit} />}
      </section>
    </RoomCodeBar>
  );
};

function BoardView({
  state,
  canTap,
  onTap,
}: {
  state: TTTRemoteState;
  canTap: boolean;
  onTap: (i: number) => void;
}) {
  return (
    <div className="mt-6 grid grid-cols-3 gap-2">
      {state.board.map((cell, i) => {
        const isWinCell = state.winLine?.includes(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onTap(i)}
            disabled={!canTap || cell !== null}
            className={`flex aspect-square items-center justify-center rounded-md border text-5xl transition-colors ${
              isWinCell
                ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)]"
                : "border-border bg-bg/40 hover:border-[hsl(var(--ember)/0.4)]"
            } ${!canTap || cell !== null ? "disabled:opacity-80" : ""}`}
          >
            <span className={`font-display italic ${cell === "X" ? "text-[hsl(var(--ember))]" : "text-fg"}`}>
              {cell ?? ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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

function QuitButton({ onQuit }: { onQuit: () => void }) {
  return (
    <button
      type="button"
      onClick={onQuit}
      className="mt-8 block w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
    >
      Leave room
    </button>
  );
}

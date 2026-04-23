"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { N, type GoRemoteState, type GoRemoteAction } from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const GoRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as GoRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: GoRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + state.turn : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const [bId, wId] = state.playerOrder;
    const winnerIds = state.winner === "B" ? [bId] : [wId];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${state.blackScore} vs ${state.whiteScore}`],
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
  const [bId, wId] = state.playerOrder;
  const myIdx = state.playerOrder.indexOf(me);
  const mySeat: "B" | "W" | null = myIdx === 0 ? "B" : myIdx === 1 ? "W" : null;
  const myTurn = mySeat !== null && mySeat === state.turn && state.kind === "playing";
  const activeName = state.turn === "B" ? findName(bId) : findName(wId);

  if (state.kind === "end") {
    const winnerName = state.winner === "B" ? findName(bId) : findName(wId);
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Game over</p>
          <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">{winnerName} wins.</h2>
          <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
            <div className="flex justify-between text-sm">
              <span>Black ({findName(bId)})</span>
              <span>{state.blackScore}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>White ({findName(wId)}) + 6.5 komi</span>
              <span>{state.whiteScore}</span>
            </div>
          </div>
          <div className="mt-10 flex gap-3">
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
        </section>
      </RoomCodeBar>
    );
  }

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{findName(bId)} ● vs {findName(wId)} ○</span>
          <span className={state.turn === "B" ? "text-fg" : "text-[hsl(var(--ember))]"}>
            {myTurn ? "Your turn" : `${activeName}'s turn`}
          </span>
        </div>

        <div
          className="mt-4 grid gap-0.5 rounded-md border border-border bg-[#c9a96a] p-2"
          style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}
        >
          {state.grid.flatMap((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => dispatch({ type: "play", r, c })}
                disabled={!myTurn || cell !== null}
                className="flex aspect-square items-center justify-center transition-colors hover:bg-[#b89860] disabled:hover:bg-[#c9a96a]"
              >
                {cell === "B" && <div className="h-4/5 w-4/5 rounded-full bg-[#0a0705]" />}
                {cell === "W" && <div className="h-4/5 w-4/5 rounded-full bg-[#f5efe4]" />}
                {cell === null && <div className="h-1 w-1 rounded-full bg-[#1a1008]/40" />}
              </button>
            )),
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!myTurn}
            onClick={() => dispatch({ type: "pass" })}
            className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg disabled:opacity-40"
          >
            Pass
          </button>
          <button type="button" onClick={onQuit} className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg">
            Leave
          </button>
        </div>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Two passes in a row end the game. {state.passes === 1 ? "Another pass ends it." : ""}
        </p>
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

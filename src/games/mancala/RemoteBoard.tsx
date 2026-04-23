"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  STORE_A_IDX,
  STORE_B_IDX,
  isAPit,
  isBPit,
  type MancalaRemoteState,
  type MancalaRemoteAction,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const MancalaRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as MancalaRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: MancalaRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + state.turn : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const [aId, bId] = state.playerOrder;
    const a = state.board[STORE_A_IDX];
    const b = state.board[STORE_B_IDX];
    const winnerIds = state.winner === "draw" ? state.playerOrder : state.winner === "A" ? [aId] : [bId];
    const aName = players.find((p) => p.id === aId)?.name ?? "?";
    const bName = players.find((p) => p.id === bId)?.name ?? "?";
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${aName} ${a} — ${bName} ${b}`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Setting up pits…</p>
      </section>
    );
  }

  const findName = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const [aId, bId] = state.playerOrder;
  const myIdx = state.playerOrder.indexOf(me);
  const mySeat: "A" | "B" | null = myIdx === 0 ? "A" : myIdx === 1 ? "B" : null;
  const myTurn = mySeat !== null && mySeat === state.turn && state.kind === "playing";

  function Pit({ idx, color }: { idx: number; color: "A" | "B" }) {
    const count = state!.board[idx];
    const canTap =
      myTurn && mySeat === color && state!.board[idx] > 0 &&
      ((color === "A" && isAPit(idx)) || (color === "B" && isBPit(idx)));
    return (
      <button
        type="button"
        disabled={!canTap}
        onClick={() => dispatch({ type: "play", pit: idx })}
        className={`flex aspect-square flex-col items-center justify-center rounded-full border-2 ${
          canTap
            ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] hover:bg-[hsl(var(--ember)/0.2)]"
            : "border-border/60 bg-bg/40"
        }`}
      >
        <span className="font-display text-2xl italic text-fg">{count}</span>
      </button>
    );
  }

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>
            <span className="text-[hsl(var(--ember))]">{findName(aId)}</span> {state.board[STORE_A_IDX]} · {findName(bId)} {state.board[STORE_B_IDX]}
          </span>
          <span>
            {state.kind === "end"
              ? "Game over"
              : myTurn
                ? "Your turn"
                : `${state.turn === "A" ? findName(aId) : findName(bId)}'s turn`}
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-[#1a1008] p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-24 w-14 flex-col items-center justify-center rounded-xl border-2 border-border bg-[#2a1a10] text-center">
              <span className="font-mono text-[10px] uppercase text-muted">{findName(bId)}</span>
              <span className="mt-1 font-display text-2xl italic text-fg">{state.board[STORE_B_IDX]}</span>
            </div>
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-6 gap-1.5">
                {[12, 11, 10, 9, 8, 7].map((idx) => <Pit key={idx} idx={idx} color="B" />)}
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((idx) => <Pit key={idx} idx={idx} color="A" />)}
              </div>
            </div>
            <div className="flex h-24 w-14 flex-col items-center justify-center rounded-xl border-2 border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] text-center">
              <span className="font-mono text-[10px] uppercase text-muted">{findName(aId)}</span>
              <span className="mt-1 font-display text-2xl italic text-[hsl(var(--ember))]">{state.board[STORE_A_IDX]}</span>
            </div>
          </div>
        </div>

        {state.kind === "end" && (
          <div className="mt-6 text-center">
            <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
              {state.winner === "draw"
                ? "Draw."
                : `${state.winner === "A" ? findName(aId) : findName(bId)} wins.`}
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
          <>
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
              Tap a pit on your row. Sow counter-clockwise.
            </p>
            <button type="button" onClick={onQuit} className="mt-4 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
              Leave room
            </button>
          </>
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

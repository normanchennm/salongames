"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  POINTS,
  canMove,
  type BGRemoteState,
  type BGRemoteAction,
  type Player,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

function Checker({ count, who }: { count: number; who: Player }) {
  const bg = who === 0 ? "bg-[#f5efe4]" : "bg-[#1a1008]";
  const text = who === 0 ? "text-[#1a1008]" : "text-[#f5efe4]";
  return (
    <div className={`flex h-5 items-center justify-center rounded-full ${bg} ${text} text-[10px] font-mono border border-border`}>
      {count > 1 ? count : ""}
    </div>
  );
}

export const BackgammonRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as BGRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: BGRemoteAction) => void;
  const completedRef = useRef(false);

  const [selected, setSelected] = useState<number | "bar" | null>(null);

  useScrollToTop(
    state ? state.kind + state.turn + state.phase.kind : "loading",
  );

  // Clear selection when phase/turn changes.
  useEffect(() => {
    setSelected(null);
  }, [state?.phase.kind, state?.turn]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const [wId, bId] = state.playerOrder;
    const winnerIds = state.winner === 0 ? [wId] : [bId];
    const wName = players.find((p) => p.id === wId)?.name ?? "?";
    const bName = players.find((p) => p.id === bId)?.name ?? "?";
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${state.winner === 0 ? wName : bName} bore off all 15`],
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
  const [wId, bId] = state.playerOrder;
  const myIdx = state.playerOrder.indexOf(me);
  const mySeat: Player | null = myIdx === 0 ? 0 : myIdx === 1 ? 1 : null;
  const myTurn = mySeat !== null && mySeat === state.turn && state.kind === "playing";
  const activeName = state.turn === 0 ? findName(wId) : findName(bId);
  const who = state.turn;
  const onBar = who === 0 ? state.board.barW : state.board.barB;
  const mustEnter = onBar > 0;
  const dice = state.phase.kind === "move" ? state.phase.dice : [];

  if (state.kind === "end") {
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Backgammon</p>
          <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
            {state.winner === 0 ? findName(wId) : findName(bId)} wins.
          </h2>
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

  if (state.phase.kind === "roll") {
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            {myTurn ? "Your roll" : `${activeName}'s roll`}
          </p>
          {myTurn ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "roll" })}
              className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Roll →
            </button>
          ) : (
            <p className="mt-10 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-sm text-muted">
              Waiting for {activeName} to roll…
            </p>
          )}
          <button type="button" onClick={onQuit} className="mt-6 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Leave room
          </button>
        </section>
      </RoomCodeBar>
    );
  }

  // MOVE
  function canSelectPoint(i: number): boolean {
    const owned = who === 0 ? state!.board.points[i] > 0 : state!.board.points[i] < 0;
    if (!owned) return false;
    return dice.some((d) => canMove(state!.board, who, i, d));
  }

  function selectPoint(i: number | "bar") {
    if (!myTurn) return;
    if (mustEnter && i !== "bar") return;
    if (i !== "bar") {
      if (!canSelectPoint(i)) return;
    }
    setSelected(i);
  }

  function applyDie(die: number) {
    if (!myTurn || selected === null) return;
    dispatch({ type: "move", from: selected, die });
    setSelected(null);
  }

  function renderPoint(i: number) {
    const v = state!.board.points[i];
    const cnt = Math.abs(v);
    const owner: Player | null = v > 0 ? 0 : v < 0 ? 1 : null;
    const isSelectable = myTurn && !mustEnter && owner === who && canSelectPoint(i);
    const isSelected = selected === i;
    const items: React.ReactNode[] = [];
    for (let k = 0; k < Math.min(cnt, 5); k++) {
      items.push(<Checker key={k} count={k === 0 ? cnt : 1} who={owner!} />);
    }
    return (
      <button
        key={i}
        type="button"
        onClick={() => selectPoint(i)}
        disabled={!isSelectable && !isSelected}
        className={`flex min-h-16 flex-col items-center justify-between gap-0.5 rounded-md border p-1 text-center ${
          isSelected
            ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)]"
            : isSelectable
              ? "border-border hover:border-[hsl(var(--ember)/0.6)]"
              : "border-border/40"
        }`}
      >
        <span className="font-mono text-[9px] uppercase text-muted">{i + 1}</span>
        <div className="flex flex-col gap-0.5 items-center">{items}</div>
      </button>
    );
  }

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>{myTurn ? "Your turn" : `${activeName}'s turn`}</span>
          <span>Dice: {dice.join(" ")}</span>
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          W bar: {state.board.barW} · B bar: {state.board.barB} · W off: {state.board.offW} · B off: {state.board.offB}
        </p>

        {mustEnter && myTurn && (
          <button
            type="button"
            onClick={() => selectPoint("bar")}
            className={`mt-3 w-full rounded-md border py-2 font-mono text-xs uppercase ${
              selected === "bar" ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] text-[hsl(var(--ember))]" : "border-border bg-bg/40 text-fg"
            }`}
          >
            Re-enter from bar
          </button>
        )}

        <div className="mt-3 grid grid-cols-6 gap-1">
          {Array.from({ length: 12 }, (_, k) => 23 - k).reverse().map((i) => renderPoint(i))}
        </div>
        <div className="my-2 h-px bg-border/40" />
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 12 }, (_, k) => k).map((i) => renderPoint(i))}
        </div>

        {myTurn && selected !== null && (
          <div className="mt-3 rounded-md border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] p-3">
            <p className="font-mono text-[10px] uppercase text-muted">Apply a die</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {dice.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyDie(d)}
                  disabled={!canMove(state.board, who, selected, d)}
                  className="rounded-md border border-border bg-bg/60 py-2 font-mono text-sm disabled:opacity-40"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onQuit}
          className="mt-4 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
        >
          Leave room
        </button>
      </section>
    </RoomCodeBar>
  );
};

function RoomCodeBar({ code, children }: { code: string; children: React.ReactNode }) {
  void POINTS;
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

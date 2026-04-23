"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  ADJ,
  POSITIONS,
  countPieces,
  type NMMRemoteState,
  type NMMRemoteAction,
  type Player,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const NineMensMorrisRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as NMMRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: NMMRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + state.turn + state.phase : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const [aId, bId] = state.playerOrder;
    const winnerIds = state.winner === "A" ? [aId] : [bId];
    const winnerName = state.winner === "A" ? (players.find((p) => p.id === aId)?.name ?? "?") : (players.find((p) => p.id === bId)?.name ?? "?");
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${winnerName} wins Nine Men's Morris`],
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
  const [aId, bId] = state.playerOrder;
  const myIdx = state.playerOrder.indexOf(me);
  const mySeat: Player | null = myIdx === 0 ? "A" : myIdx === 1 ? "B" : null;
  const myTurn = mySeat !== null && mySeat === state.turn && state.kind === "playing";
  const aPieces = countPieces(state.board, "A");
  const bPieces = countPieces(state.board, "B");
  const turnName = state.turn === "A" ? findName(aId) : findName(bId);

  const STEP = 50, PAD = 30, SVG = 6 * STEP + PAD * 2;
  const px = (x: number) => PAD + x * STEP;

  const turnFlying = state.placed[state.turn] === 9 && countPieces(state.board, state.turn) === 3;

  function canTapPos(i: number): boolean {
    if (!myTurn) return false;
    const cell = state!.board[i];
    if (state!.pendingCapture) {
      return cell === (state!.turn === "A" ? "B" : "A");
    }
    if (state!.phase === "place") return cell === null;
    if (state!.phase === "move") {
      if (state!.selected === null) return cell === state!.turn;
      if (i === state!.selected) return true;
      return cell === null && (turnFlying || ADJ[state!.selected].includes(i));
    }
    return false;
  }

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>
            <span className="text-[hsl(var(--ember))]">{findName(aId)}</span> {aPieces} (to place: {9 - state.placed.A}) · {findName(bId)} {bPieces} (to place: {9 - state.placed.B})
          </span>
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          {state.kind === "end"
            ? "Game over"
            : state.pendingCapture
              ? myTurn
                ? "Remove an opponent piece"
                : `${turnName} — removing a piece`
              : state.phase === "place"
                ? myTurn
                  ? "Your turn to place"
                  : `${turnName} to place`
                : myTurn
                  ? `Your turn to move${turnFlying ? " (flying)" : ""}`
                  : `${turnName} to move${turnFlying ? " (flying)" : ""}`}
        </p>

        <svg viewBox={`0 0 ${SVG} ${SVG}`} className="mt-3 w-full rounded-md border border-border bg-bg/40">
          {[[0,1,2,3,4,5,6,7],[8,9,10,11,12,13,14,15],[16,17,18,19,20,21,22,23]].map((ring, ri) => (
            <rect
              key={ri}
              x={px(POSITIONS[ring[0]][0])}
              y={px(POSITIONS[ring[0]][1])}
              width={(POSITIONS[ring[4]][0] - POSITIONS[ring[0]][0]) * STEP}
              height={(POSITIONS[ring[4]][1] - POSITIONS[ring[0]][1]) * STEP}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-muted/70"
            />
          ))}
          {[[1,9,17],[7,15,23],[3,11,19],[5,13,21]].map((line, li) => (
            <line
              key={li}
              x1={px(POSITIONS[line[0]][0])}
              y1={px(POSITIONS[line[0]][1])}
              x2={px(POSITIONS[line[2]][0])}
              y2={px(POSITIONS[line[2]][1])}
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-muted/70"
            />
          ))}
          {POSITIONS.map((pos, i) => {
            const cell = state.board[i];
            const isSelected = state.selected === i;
            const tappable = canTapPos(i);
            return (
              <g key={i}>
                <circle
                  cx={px(pos[0])}
                  cy={px(pos[1])}
                  r={14}
                  fill="#1a1008"
                  stroke={isSelected ? "hsl(var(--ember))" : "rgba(255,255,255,0.15)"}
                  strokeWidth={isSelected ? 3 : 1}
                />
                {cell && (
                  <circle
                    cx={px(pos[0])}
                    cy={px(pos[1])}
                    r={11}
                    fill={cell === "A" ? "hsl(var(--ember))" : "#5a8fa8"}
                  />
                )}
                {tappable && (
                  <circle
                    cx={px(pos[0])}
                    cy={px(pos[1])}
                    r={18}
                    fill="transparent"
                    className="cursor-pointer"
                    pointerEvents="all"
                    onClick={() => dispatch({ type: "click", pos: i })}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {state.kind === "end" && (
          <div className="mt-6 text-center">
            <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
              {state.winner === "A" ? findName(aId) : findName(bId)} wins.
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

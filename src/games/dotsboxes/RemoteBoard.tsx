"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  COLS,
  ROWS,
  scores,
  type DBRemoteState,
  type DBRemoteAction,
  type Owner,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const DotsBoxesRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as DBRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: DBRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + state.turn : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const [p1, p2] = state.playerOrder;
    const s = scores(state.board);
    const winnerIds = state.winner === "draw" ? state.playerOrder : state.winner === "P1" ? [p1] : [p2];
    const p1Name = players.find((p) => p.id === p1)?.name ?? "?";
    const p2Name = players.find((p) => p.id === p2)?.name ?? "?";
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${p1Name} ${s.P1} — ${p2Name} ${s.P2}`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Setting up grid…</p>
      </section>
    );
  }

  const findName = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const [p1Id, p2Id] = state.playerOrder;
  const myIdx = state.playerOrder.indexOf(me);
  const mySeat: "P1" | "P2" | null = myIdx === 0 ? "P1" : myIdx === 1 ? "P2" : null;
  const myTurn = mySeat !== null && mySeat === state.turn && state.kind === "playing";
  const s = scores(state.board);

  const lineColor = (o: Owner) =>
    o === "P1" ? "hsl(var(--ember))" : o === "P2" ? "#5a8fa8" : "rgba(255,255,255,0.08)";
  const boxColor = (o: Owner) =>
    o === "P1" ? "hsla(var(--ember) / 0.18)" : o === "P2" ? "rgba(90,143,168,0.22)" : "transparent";

  const STEP = 70;
  const DOT = 5;
  const PAD = 20;
  const W = COLS * STEP + PAD * 2;
  const H = ROWS * STEP + PAD * 2;

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>
            <span className="text-[hsl(var(--ember))]">{findName(p1Id)} {s.P1}</span> vs{" "}
            <span className="text-[#5a8fa8]">{findName(p2Id)} {s.P2}</span>
          </span>
          <span>
            {state.kind === "end"
              ? "Game over"
              : myTurn
                ? "Your turn"
                : `${state.turn === "P1" ? findName(p1Id) : findName(p2Id)}'s turn`}
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full rounded-md border border-border bg-bg/40">
          {state.board.boxes.flatMap((row, r) =>
            row.map((o, c) => (
              <rect
                key={`b-${r}-${c}`}
                x={PAD + c * STEP}
                y={PAD + r * STEP}
                width={STEP}
                height={STEP}
                fill={boxColor(o)}
              />
            )),
          )}

          {state.board.hLines.flatMap((row, r) =>
            row.map((o, c) => (
              <g key={`h-${r}-${c}`}>
                <line
                  x1={PAD + c * STEP}
                  y1={PAD + r * STEP}
                  x2={PAD + (c + 1) * STEP}
                  y2={PAD + r * STEP}
                  stroke={lineColor(o)}
                  strokeWidth={o ? 4 : 2}
                  strokeLinecap="round"
                />
                {o === null && myTurn && (
                  <rect
                    x={PAD + c * STEP + 6}
                    y={PAD + r * STEP - 10}
                    width={STEP - 12}
                    height={20}
                    fill="transparent"
                    onClick={() => dispatch({ type: "play", lineKind: "h", r, c })}
                    className="cursor-pointer"
                    pointerEvents="all"
                  />
                )}
              </g>
            )),
          )}

          {state.board.vLines.flatMap((row, r) =>
            row.map((o, c) => (
              <g key={`v-${r}-${c}`}>
                <line
                  x1={PAD + c * STEP}
                  y1={PAD + r * STEP}
                  x2={PAD + c * STEP}
                  y2={PAD + (r + 1) * STEP}
                  stroke={lineColor(o)}
                  strokeWidth={o ? 4 : 2}
                  strokeLinecap="round"
                />
                {o === null && myTurn && (
                  <rect
                    x={PAD + c * STEP - 10}
                    y={PAD + r * STEP + 6}
                    width={20}
                    height={STEP - 12}
                    fill="transparent"
                    onClick={() => dispatch({ type: "play", lineKind: "v", r, c })}
                    className="cursor-pointer"
                    pointerEvents="all"
                  />
                )}
              </g>
            )),
          )}

          {Array.from({ length: ROWS + 1 }).flatMap((_, r) =>
            Array.from({ length: COLS + 1 }).map((_, c) => (
              <circle key={`d-${r}-${c}`} cx={PAD + c * STEP} cy={PAD + r * STEP} r={DOT} fill="currentColor" className="text-fg" />
            )),
          )}

          {state.board.boxes.flatMap((row, r) =>
            row.map((o, c) =>
              o ? (
                <text
                  key={`t-${r}-${c}`}
                  x={PAD + c * STEP + STEP / 2}
                  y={PAD + r * STEP + STEP / 2 + 7}
                  textAnchor="middle"
                  className="font-display italic"
                  fontSize="24"
                  fill={o === "P1" ? "hsl(var(--ember))" : "#5a8fa8"}
                >
                  {(o === "P1" ? findName(p1Id) : findName(p2Id)).slice(0, 1).toUpperCase()}
                </text>
              ) : null,
            ),
          )}
        </svg>

        {state.kind === "end" && (
          <div className="mt-6 text-center">
            <h2 className="font-display text-3xl italic text-[hsl(var(--ember))]">
              {state.winner === "draw"
                ? "Draw."
                : `${state.winner === "P1" ? findName(p1Id) : findName(p2Id)} wins.`}
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

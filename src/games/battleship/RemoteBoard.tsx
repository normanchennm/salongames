"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import {
  SIZE,
  SHIP_LENGTHS,
  SHIP_NAMES,
  type BSRemoteState,
  type BSRemoteAction,
  type Orientation,
  type Ship,
  canPlace,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const BattleshipRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as BSRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: BSRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const winnerId = state.playerOrder[state.winnerIdx];
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: [winnerId],
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${players.find((p) => p.id === winnerId)?.name ?? "?"} sank the fleet`],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Preparing the waters…</p>
      </section>
    );
  }

  const myIdx = state.playerOrder.indexOf(me);
  const oppIdx = myIdx === 0 ? 1 : myIdx === 1 ? 0 : -1;
  const findName = (peerId: string) => players.find((p) => p.id === peerId)?.name ?? "?";

  // Spectator: more than 2 players in the room, or I'm not seated.
  if (myIdx < 0) {
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Spectator</p>
          <h2 className="mt-2 font-display text-2xl italic">
            {findName(state.playerOrder[0])} vs {findName(state.playerOrder[1])}
          </h2>
          <p className="mt-3 text-sm text-muted">Battleship is a two-player game. The first two to join the room take the seats.</p>
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "placing") {
    const myBoard = state.boards[myIdx];
    const oppBoard = state.boards[oppIdx];
    if (myBoard.placed) {
      return (
        <RoomCodeBar code={remote.code}>
          <section className="mx-auto max-w-md animate-fade-up text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Placement complete</p>
            <h2 className="mt-2 font-display text-3xl italic">Fleet ready.</h2>
            <p className="mt-3 text-sm text-muted">
              Waiting for {findName(state.playerOrder[oppIdx])}
              {oppBoard.placed ? " (ready)" : " to finish placing"}…
            </p>
            <QuitButton onQuit={onQuit} />
          </section>
        </RoomCodeBar>
      );
    }
    return (
      <RoomCodeBar code={remote.code}>
        <PlaceFleetUI
          onSubmit={(ships) => dispatch({ type: "place-fleet", ships })}
          onQuit={onQuit}
        />
      </RoomCodeBar>
    );
  }

  if (state.kind === "end") {
    const iWon = state.winnerIdx === myIdx;
    const winnerName = findName(state.playerOrder[state.winnerIdx]);
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Victory</p>
          <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
            {iWon ? "You win." : `${winnerName} wins.`}
          </h2>
          <p className="mt-4 text-sm text-muted">All enemy ships sunk.</p>
          <div className="mt-10 flex gap-3">
            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  completedRef.current = false;
                  dispatch({ type: "play-again" });
                }}
                className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
              >
                Play again
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
              Leave room
            </button>
          </div>
        </section>
      </RoomCodeBar>
    );
  }

  // PLAYING
  const myTurn = state.turn === myIdx;
  const myBoard = state.boards[myIdx];
  const oppBoard = state.boards[oppIdx];

  return (
    <RoomCodeBar code={remote.code}>
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            {myTurn ? "Your turn to fire" : `${findName(state.playerOrder[oppIdx])}'s turn`}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
            you vs {findName(state.playerOrder[oppIdx])}
          </p>
        </div>

        {state.lastShot && (
          <p className="mt-3 rounded-md border border-border bg-bg/40 px-3 py-2 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            last shot: {coordLabel(state.lastShot.r, state.lastShot.c)}{" "}
            {state.lastShot.hit ? (state.lastShot.sunk ? "— sunk" : "— hit") : "— miss"}
          </p>
        )}

        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          Opponent&apos;s waters {myTurn ? "— tap to fire" : "(waiting)"}
        </p>
        <div className="mt-2">
          <MiniGrid
            board={oppBoard}
            revealShips={false}
            interactive={myTurn}
            onTap={(r, c) => dispatch({ type: "fire", r, c })}
          />
        </div>

        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Your fleet</p>
        <div className="mt-2">
          <MiniGrid board={myBoard} revealShips={true} interactive={false} onTap={() => {}} />
        </div>

        <button
          type="button"
          onClick={onQuit}
          className="mt-6 block w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
        >
          Leave room
        </button>
      </section>
    </RoomCodeBar>
  );
};

// ─── place fleet UI ──────────────────────────────────────────────────

function PlaceFleetUI({
  onSubmit,
  onQuit,
}: {
  onSubmit: (ships: Ship[]) => void;
  onQuit: () => void;
}) {
  const [ships, setShips] = useState<Ship[]>([]);
  const [orient, setOrient] = useState<Orientation>("H");
  const nextIndex = ships.length;
  const done = nextIndex >= SHIP_LENGTHS.length;
  const length = SHIP_LENGTHS[nextIndex] ?? 0;

  const fakeBoard = { playerId: "me", ships, placed: false, hits: [] as boolean[][] };
  // Reconstruct occupied cells for preview-click validation.
  const tryPlace = (r: number, c: number) => {
    if (done) return;
    if (!canPlace(fakeBoard as unknown as Parameters<typeof canPlace>[0], r, c, length, orient)) return;
    const cells: Array<[number, number]> = [];
    for (let k = 0; k < length; k++) {
      const rr = orient === "V" ? r + k : r;
      const cc = orient === "H" ? c + k : c;
      cells.push([rr, cc]);
    }
    setShips([...ships, { length, cells }]);
  };

  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Place your fleet</p>
      {!done ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
            {SHIP_NAMES[nextIndex]} · {orient === "H" ? "Horizontal" : "Vertical"}
          </span>
          <button
            type="button"
            onClick={() => setOrient(orient === "H" ? "V" : "H")}
            className="rounded-md border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
          >
            Rotate
          </button>
        </div>
      ) : (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">Fleet ready</p>
      )}
      <div className="mt-3">
        <PlacementGrid
          occupied={occupiedFromShips(ships)}
          nextLength={done ? 0 : length}
          orient={orient}
          onPlace={tryPlace}
        />
      </div>
      <div className="mt-3 rounded-md border border-border bg-bg/40 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Fleet</p>
        <ul className="mt-1 space-y-0.5 font-mono text-xs">
          {SHIP_NAMES.map((name, i) => (
            <li
              key={name}
              className={`flex justify-between ${
                i < ships.length
                  ? "text-muted/60 line-through"
                  : i === ships.length
                    ? "text-[hsl(var(--ember))]"
                    : "text-fg"
              }`}
            >
              <span>{name}</span>
              <span>{i < ships.length ? "placed" : i === ships.length ? "placing…" : "pending"}</span>
            </li>
          ))}
        </ul>
      </div>
      {done ? (
        <button
          type="button"
          onClick={() => onSubmit(ships)}
          className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Lock fleet →
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShips(ships.slice(0, -1))}
          disabled={ships.length === 0}
          className="mt-4 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg disabled:opacity-40"
        >
          Undo last
        </button>
      )}
      <button
        type="button"
        onClick={onQuit}
        className="mt-3 block w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
      >
        Leave room
      </button>
    </section>
  );
}

function occupiedFromShips(ships: Ship[]): Set<string> {
  const s = new Set<string>();
  for (const ship of ships) for (const [r, c] of ship.cells) s.add(`${r},${c}`);
  return s;
}

function PlacementGrid({
  occupied,
  nextLength,
  orient,
  onPlace,
}: {
  occupied: Set<string>;
  nextLength: number;
  orient: Orientation;
  onPlace: (r: number, c: number) => void;
}) {
  return (
    <div
      className="grid gap-0.5 rounded-md border border-border bg-bg/40 p-1.5"
      style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: SIZE }).flatMap((_, r) =>
        Array.from({ length: SIZE }).map((_, c) => {
          const ship = occupied.has(`${r},${c}`);
          // No preview rendered (touch UX); just tap to place.
          const bg = ship ? "bg-[#4a5a6a]" : "bg-[#142a3a]";
          return (
            <button
              key={`${r},${c}`}
              type="button"
              onClick={() => onPlace(r, c)}
              disabled={nextLength === 0}
              className={`flex aspect-square items-center justify-center ${bg} transition-colors`}
              aria-label={`${String.fromCharCode(65 + r)}${c + 1}`}
            />
          );
        }),
      )}
      {void orient}
    </div>
  );
}

// ─── mini grid (for playing phase) ───────────────────────────────────

function MiniGrid({
  board,
  revealShips,
  interactive,
  onTap,
}: {
  board: { ships: Ship[]; hits: boolean[][] };
  revealShips: boolean;
  interactive: boolean;
  onTap: (r: number, c: number) => void;
}) {
  const shipCells = new Set<string>();
  for (const s of board.ships) for (const [r, c] of s.cells) shipCells.add(`${r},${c}`);
  return (
    <div
      className="grid gap-0.5 rounded-md border border-border bg-bg/40 p-1.5"
      style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: SIZE }).flatMap((_, r) =>
        Array.from({ length: SIZE }).map((_, c) => {
          const key = `${r},${c}`;
          const isShip = shipCells.has(key);
          const isHit = board.hits[r]?.[c] ?? false;
          let bg = "bg-[#142a3a]";
          if (revealShips && isShip && !isHit) bg = "bg-[#4a5a6a]";
          if (isHit && isShip) bg = "bg-[hsl(var(--ember))]";
          if (isHit && !isShip) bg = "bg-[#1a1a22]";
          return (
            <button
              key={key}
              type="button"
              disabled={!interactive || isHit}
              onClick={() => onTap(r, c)}
              className={`flex aspect-square items-center justify-center ${bg} transition-colors`}
              aria-label={`${String.fromCharCode(65 + r)}${c + 1}`}
            >
              {isHit && isShip && <span className="text-[10px] text-bg">✕</span>}
              {isHit && !isShip && <span className="h-1 w-1 rounded-full bg-white/60" />}
            </button>
          );
        }),
      )}
    </div>
  );
}

function coordLabel(r: number, c: number): string {
  return `${String.fromCharCode(65 + r)}${c + 1}`;
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
      className="mt-6 block w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
    >
      Leave room
    </button>
  );
}

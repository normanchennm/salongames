"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, ONENIGHT_CUES } from "@/lib/narrator";
import {
  ROLE_BLURB,
  ROLE_LABEL,
  type ONRemoteState,
  type ONRemoteAction,
  type Role,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const OneNightWWRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as ONRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: ONRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + ("step" in state ? `-${state.step}` : "") : "loading");

  useEffect(() => {
    if (!state) return;
    if (state.kind === "night") playCue(ONENIGHT_CUES.nightIntro);
    else if (state.kind === "day") playCue(ONENIGHT_CUES.dayIntro);
    else if (state.kind === "end")
      playCue(state.winner === "village" ? ONENIGHT_CUES.villageWins : ONENIGHT_CUES.werewolvesWin);
  }, [state]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const winnerIds = state.playerOrder.filter((id) =>
      state.winner === "village" ? state.currentRoles[id] !== "werewolf" : state.currentRoles[id] === "werewolf",
    );
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [
        `${state.winner === "village" ? "Village" : "Werewolves"} won`,
        state.killedIds.length > 0
          ? `Killed: ${state.killedIds.map((id) => players.find((p) => p.id === id)?.name ?? "?").join(", ")}`
          : "No one was killed",
      ],
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section role="status" aria-live="polite" className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Dealing roles…</p>
      </section>
    );
  }

  const findName = (peerId: string) => players.find((p) => p.id === peerId)?.name ?? "?";

  if (state.kind === "reveal") {
    const myRole = state.startingRoles[me];
    const iConfirmed = !!state.confirmed[me];
    const confirmedCount = Object.keys(state.confirmed).length;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Role reveal</p>
          {myRole ? (
            iConfirmed ? (
              <div className="mt-4 rounded-lg border border-border bg-bg/40 p-5 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Noted</p>
                <p className="mt-2 font-display text-2xl italic">Waiting for the rest…</p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
                  {confirmedCount} / {state.playerOrder.length} ready
                </p>
              </div>
            ) : (
              <RoleCard role={myRole} onConfirm={() => dispatch({ type: "confirm-role" })} />
            )
          ) : (
            <p className="mt-4 text-sm text-muted">Spectating.</p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "end") {
    const accent = state.winner === "village" ? "text-[hsl(var(--ember))]" : "text-[#b94a4a]";
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Dawn verdict</p>
          <h2 className={`mt-2 font-display text-5xl italic ${accent}`}>
            {state.winner === "village" ? "Village wins." : "Wolves win."}
          </h2>
          <div className="mt-6 rounded-md border border-border bg-bg/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Cards at dawn</p>
            <ul className="mt-2 divide-y divide-border/50">
              {state.playerOrder.map((id) => {
                const killed = state.killedIds.includes(id);
                const current = state.currentRoles[id];
                const start = state.startingRoles[id];
                return (
                  <li key={id} className="flex items-baseline justify-between py-1.5 text-sm">
                    <span className={`font-display italic ${killed ? "text-[#b94a4a]" : "text-fg"}`}>
                      {findName(id)} {killed ? "†" : ""}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {ROLE_LABEL[current]}
                      {current !== start ? ` (was ${ROLE_LABEL[start]})` : ""}
                    </span>
                  </li>
                );
              })}
              <li className="flex items-baseline justify-between py-1.5 text-sm">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Center</span>
                <span className="font-mono text-xs text-muted">
                  {state.centerCards.map((r) => ROLE_LABEL[r]).join(", ")}
                </span>
              </li>
            </ul>
          </div>
          <EndControls isHost={isHost} onPlayAgain={() => { completedRef.current = false; dispatch({ type: "play-again" }); }} onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "night") {
    const myStartingRole = state.startingRoles[me];
    const activeRole = state.step;
    const iAmActive =
      (activeRole === "werewolves" && myStartingRole === "werewolf") ||
      (activeRole === "seer" && myStartingRole === "seer") ||
      (activeRole === "robber" && myStartingRole === "robber") ||
      (activeRole === "troublemaker" && myStartingRole === "troublemaker");
    const myLog = state.logs[me] ?? {};

    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
            Night · {activeRole}
          </p>
          {iAmActive ? (
            activeRole === "seer" ? (
              <SeerUI
                playerOrder={state.playerOrder.filter((id) => id !== me)}
                findName={findName}
                onPeekPlayer={(targetId) => dispatch({ type: "seer-peek-player", targetId })}
                onPeekCenter={(idxs) => dispatch({ type: "seer-peek-center", idxs })}
                onSkip={() => dispatch({ type: "seer-skip" })}
              />
            ) : activeRole === "robber" ? (
              <RobberUI
                playerOrder={state.playerOrder.filter((id) => id !== me)}
                findName={findName}
                onSwap={(targetId) => dispatch({ type: "robber-swap", targetId })}
                onSkip={() => dispatch({ type: "robber-skip" })}
              />
            ) : activeRole === "troublemaker" ? (
              <TroublemakerUI
                playerOrder={state.playerOrder.filter((id) => id !== me)}
                findName={findName}
                onSwap={(aId, bId) => dispatch({ type: "troublemaker-swap", aId, bId })}
                onSkip={() => dispatch({ type: "troublemaker-skip" })}
              />
            ) : null
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Eyes closed. The {activeRole} act.
            </p>
          )}
          {/* Show werewolf buddy info when relevant (appears during any night step). */}
          {myStartingRole === "werewolf" && myLog.wolfBuddies && (
            <p className="mt-4 rounded-md border border-[hsl(0_70%_55%/0.5)] bg-[hsl(0_70%_55%/0.08)] px-3 py-2 text-center text-xs text-fg">
              Fellow wolves: {myLog.wolfBuddies.length > 0 ? myLog.wolfBuddies.map(findName).join(", ") : "none (lone wolf)"}
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "day") {
    const myLog = state.logs[me] ?? {};
    const myCurrentRole = state.currentRoles[me];
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Dawn · discussion</p>
          <h2 className="mt-2 font-display text-3xl italic">Talk it out. Vote at will.</h2>
          <div className="mt-4 rounded-md border border-border bg-bg/40 p-4 text-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">What you know</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li className="text-fg">
                You started as <span className="font-display italic">{ROLE_LABEL[state.startingRoles[me]]}</span>.
              </li>
              {myLog.wolfBuddies && (
                <li className="text-fg">
                  Wolves you saw: {myLog.wolfBuddies.length > 0 ? myLog.wolfBuddies.map(findName).join(", ") : "none"}
                </li>
              )}
              {myLog.seerSawPlayer && (
                <li className="text-fg">
                  Seer saw {findName(myLog.seerSawPlayer.targetId)}: {ROLE_LABEL[myLog.seerSawPlayer.role]}
                </li>
              )}
              {myLog.seerSawCenter && (
                <li className="text-fg">
                  Seer saw center:{" "}
                  {myLog.seerSawCenter.map((s) => `[${s.idx + 1}] ${ROLE_LABEL[s.role]}`).join(", ")}
                </li>
              )}
              {myLog.robberNewRole && myLog.robberStoleFrom && (
                <li className="text-fg">
                  Robber stole from {findName(myLog.robberStoleFrom)}, now {ROLE_LABEL[myLog.robberNewRole]}.
                </li>
              )}
              {state.startingRoles[me] === "troublemaker" && (
                <li className="text-fg">You swapped two other cards (results unknown).</li>
              )}
            </ul>
            <p className="mt-3 text-[11px] text-muted">
              (Your current card is {ROLE_LABEL[myCurrentRole]}, but you only know this if you were the Robber.)
            </p>
          </div>
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "start-vote" })}
              className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Open vote →
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "voting") {
    const myVote = state.votes[me];
    const votedCount = Object.keys(state.votes).length;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Vote</p>
          <h2 className="mt-2 font-display text-2xl italic">Point at a werewolf.</h2>
          <p className="mt-2 text-xs text-muted">
            {votedCount} / {state.playerOrder.length} in
          </p>
          {myVote ? (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Voted {findName(myVote)}.
            </p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {state.playerOrder.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    disabled={id === me}
                    onClick={() => dispatch({ type: "vote", targetId: id })}
                    className="block w-full rounded-md border border-border bg-bg/40 px-3 py-2 text-left text-sm text-fg hover:border-[hsl(var(--ember)/0.5)] disabled:opacity-40"
                  >
                    {findName(id)} {id === me ? "(you)" : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  return null;
};

// ─── subcomponents ───────────────────────────────────────────────────

function RoleCard({ role, onConfirm }: { role: Role; onConfirm: () => void }) {
  const accent =
    role === "werewolf" ? "hsl(0 70% 55%)" : role === "seer" ? "hsl(210 80% 65%)" : role === "robber" ? "hsl(30 80% 60%)" : role === "troublemaker" ? "hsl(290 60% 60%)" : "hsl(var(--ember))";
  return (
    <div className="mt-4 rounded-lg border p-5" style={{ borderColor: accent, background: `${accent}14` }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>
        You are
      </p>
      <h2 className="mt-1 font-display text-4xl italic" style={{ color: accent }}>
        {ROLE_LABEL[role]}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-fg">{ROLE_BLURB[role]}</p>
      <button
        type="button"
        onClick={onConfirm}
        className="mt-5 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
      >
        I understand →
      </button>
    </div>
  );
}

function SeerUI({
  playerOrder,
  findName,
  onPeekPlayer,
  onPeekCenter,
  onSkip,
}: {
  playerOrder: string[];
  findName: (id: string) => string;
  onPeekPlayer: (id: string) => void;
  onPeekCenter: (idxs: [number, number]) => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<"player" | "center" | null>(null);
  const [centerPicks, setCenterPicks] = useState<number[]>([]);
  if (mode === "player") {
    return (
      <div className="mt-4 rounded-lg border border-[hsl(210_80%_65%/0.5)] bg-[hsl(210_80%_65%/0.08)] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(210_80%_65%)]">Seer — pick a player</p>
        <ul className="mt-3 space-y-1.5">
          {playerOrder.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPeekPlayer(id)}
                className="block w-full rounded-md border border-border bg-bg/40 px-3 py-2 text-left text-sm text-fg hover:border-[hsl(210_80%_65%/0.5)]"
              >
                {findName(id)}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setMode(null)}
          className="mt-3 w-full rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
        >
          Back
        </button>
      </div>
    );
  }
  if (mode === "center") {
    return (
      <div className="mt-4 rounded-lg border border-[hsl(210_80%_65%/0.5)] bg-[hsl(210_80%_65%/0.08)] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(210_80%_65%)]">Seer — pick 2 center cards</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => {
            const on = centerPicks.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() =>
                  setCenterPicks((prev) =>
                    prev.includes(i) ? prev.filter((x) => x !== i) : prev.length < 2 ? [...prev, i] : prev,
                  )
                }
                className={`rounded-md border py-6 font-mono text-sm ${
                  on
                    ? "border-[hsl(210_80%_65%)/0.7] bg-[hsl(210_80%_65%)/0.2] text-fg"
                    : "border-border bg-bg/40 text-muted"
                }`}
              >
                Center {i + 1}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={centerPicks.length !== 2}
          onClick={() => onPeekCenter([centerPicks[0], centerPicks[1]])}
          className="mt-3 w-full rounded-md bg-[hsl(210_80%_65%)] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
        >
          Peek
        </button>
        <button
          type="button"
          onClick={() => setMode(null)}
          className="mt-2 w-full rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
        >
          Back
        </button>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg border border-[hsl(210_80%_65%/0.5)] bg-[hsl(210_80%_65%/0.08)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(210_80%_65%)]">Seer — choose</p>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => setMode("player")}
          className="rounded-md border border-border bg-bg/40 px-3 py-3 text-left text-sm text-fg hover:border-[hsl(210_80%_65%/0.5)]"
        >
          Peek at one player&apos;s card
        </button>
        <button
          type="button"
          onClick={() => setMode("center")}
          className="rounded-md border border-border bg-bg/40 px-3 py-3 text-left text-sm text-fg hover:border-[hsl(210_80%_65%/0.5)]"
        >
          Peek at two center cards
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function RobberUI({
  playerOrder,
  findName,
  onSwap,
  onSkip,
}: {
  playerOrder: string[];
  findName: (id: string) => string;
  onSwap: (id: string) => void;
  onSkip: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-[hsl(30_80%_60%/0.5)] bg-[hsl(30_80%_60%/0.08)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(30_80%_60%)]">Robber — swap with</p>
      <ul className="mt-3 space-y-1.5">
        {playerOrder.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSwap(id)}
              className="block w-full rounded-md border border-border bg-bg/40 px-3 py-2 text-left text-sm text-fg hover:border-[hsl(30_80%_60%/0.5)]"
            >
              {findName(id)}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSkip}
        className="mt-3 w-full rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
      >
        Skip
      </button>
    </div>
  );
}

function TroublemakerUI({
  playerOrder,
  findName,
  onSwap,
  onSkip,
}: {
  playerOrder: string[];
  findName: (id: string) => string;
  onSwap: (aId: string, bId: string) => void;
  onSkip: () => void;
}) {
  const [picks, setPicks] = useState<string[]>([]);
  const toggle = (id: string) => {
    setPicks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev));
  };
  return (
    <div className="mt-4 rounded-lg border border-[hsl(290_60%_60%/0.5)] bg-[hsl(290_60%_60%/0.08)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(290_60%_60%)]">Troublemaker — swap two others</p>
      <ul className="mt-3 space-y-1.5">
        {playerOrder.map((id) => {
          const on = picks.includes(id);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => toggle(id)}
                className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  on ? "border-[hsl(290_60%_60%)/0.7] bg-[hsl(290_60%_60%)/0.18] text-fg" : "border-border bg-bg/40 text-fg"
                }`}
              >
                {findName(id)}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={picks.length !== 2}
        onClick={() => onSwap(picks[0], picks[1])}
        className="mt-3 w-full rounded-md bg-[hsl(290_60%_60%)] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
      >
        Swap
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="mt-2 w-full rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
      >
        Skip
      </button>
    </div>
  );
}

function EndControls({ isHost, onPlayAgain, onQuit }: { isHost: boolean; onPlayAgain: () => void; onQuit: () => void }) {
  return (
    <div className="mt-8 flex gap-3">
      {isHost ? (
        <button type="button" onClick={onPlayAgain} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg">
          Play again
        </button>
      ) : (
        <p className="flex-1 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-xs text-muted">Waiting for host…</p>
      )}
      <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">
        Leave room
      </button>
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
      className="mt-6 block w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
    >
      Leave room
    </button>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, RESISTANCE_CUES } from "@/lib/narrator";
import {
  TEAM_SIZES,
  missionNeeds2Fails,
  type ResistanceRemoteState,
  type ResistanceRemoteAction,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const ResistanceRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as ResistanceRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: ResistanceRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + ("mission" in state ? `-m${state.mission}` : "") : "loading");

  useEffect(() => {
    if (!state) return;
    if (state.kind === "vote-result")
      playCue(state.approved ? RESISTANCE_CUES.proposalApproved : RESISTANCE_CUES.proposalRejected);
    else if (state.kind === "mission-result")
      playCue(state.success ? RESISTANCE_CUES.missionSuccess : RESISTANCE_CUES.missionFail);
    else if (state.kind === "end")
      playCue(state.winner === "resistance" ? RESISTANCE_CUES.resistanceWins : RESISTANCE_CUES.spiesWin);
  }, [state]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const winnerIds = Object.entries(state.roles)
      .filter(([, r]) => (state.winner === "resistance" ? r === "resistance" : r === "spy"))
      .map(([id]) => id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${state.winner === "resistance" ? "Resistance" : "Spies"} won`],
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
    const myRole = state.roles[me];
    const confirmedCount = Object.keys(state.confirmed).length;
    const iConfirmed = !!state.confirmed[me];
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
              <div
                className={`mt-4 rounded-lg border p-5 ${
                  myRole === "spy"
                    ? "border-[hsl(0_70%_55%/0.5)] bg-[hsl(0_70%_55%/0.08)]"
                    : "border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)]"
                }`}
              >
                <p
                  className={`font-mono text-[10px] uppercase tracking-[0.3em] ${
                    myRole === "spy" ? "text-[hsl(0_70%_55%)]" : "text-[hsl(var(--ember))]"
                  }`}
                >
                  You are
                </p>
                <h2
                  className={`mt-1 font-display text-4xl italic ${
                    myRole === "spy" ? "text-[hsl(0_70%_55%)]" : "text-[hsl(var(--ember))]"
                  }`}
                >
                  {myRole === "spy" ? "Spy" : "Resistance"}
                </h2>
                {myRole === "spy" && (
                  <p className="mt-3 text-xs text-muted">
                    Fellow spies:{" "}
                    {Object.entries(state.roles)
                      .filter(([id, r]) => r === "spy" && id !== me)
                      .map(([id]) => findName(id))
                      .join(", ")}
                  </p>
                )}
                <p className="mt-3 text-sm leading-relaxed text-fg">
                  {myRole === "spy"
                    ? "Fail missions without getting caught. 3 failures = you win. Coordinate with your team in secret."
                    : "Find the spies and complete 3 missions. You can only play SUCCESS on missions you're on."}
                </p>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "confirm-role" })}
                  className="mt-5 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
                >
                  I understand →
                </button>
              </div>
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
    const accent = state.winner === "resistance" ? "text-[hsl(var(--ember))]" : "text-[#b94a4a]";
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
          <h2 className={`mt-2 font-display text-5xl italic ${accent}`}>
            {state.winner === "resistance" ? "Resistance wins." : "Spies win."}
          </h2>
          <div className="mt-8 rounded-md border border-border bg-bg/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Roles</p>
            <ul className="mt-2 divide-y divide-border/50">
              {state.playerOrder.map((id) => (
                <li key={id} className="flex items-baseline justify-between py-1.5">
                  <span className="font-display italic text-fg">{findName(id)}</span>
                  <span
                    className={`font-mono text-xs ${
                      state.roles[id] === "spy" ? "text-[hsl(0_70%_55%)]" : "text-[hsl(var(--ember))]"
                    }`}
                  >
                    {state.roles[id] === "spy" ? "Spy" : "Resistance"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <EndControls isHost={isHost} onPlayAgain={() => { completedRef.current = false; dispatch({ type: "play-again" }); }} onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // All mid-game states share a "missions so far" header.
  const missionHeader = (
    <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
      <span className="text-muted">Mission {state.mission + 1} / 5</span>
      <MissionPips missions={state.missions} />
    </div>
  );

  if (state.kind === "team-select") {
    const leaderId = state.playerOrder[state.leaderIdx];
    const leaderName = findName(leaderId);
    const iAmLeader = me === leaderId;
    const needed = TEAM_SIZES[state.playerOrder.length]?.[state.mission] ?? 0;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          {missionHeader}
          <h2 className="mt-2 font-display text-2xl italic">
            {iAmLeader ? `Pick a team of ${needed}` : `${leaderName} is picking a team of ${needed}`}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Reject streak: {state.rejectStreak} / 5. 5 rejections in a row = spies win.
          </p>
          {iAmLeader ? (
            <LeaderTeamPicker
              playerOrder={state.playerOrder}
              needed={needed}
              findName={findName}
              onSubmit={(teamIds) => dispatch({ type: "propose-team", teamIds })}
            />
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Waiting for {leaderName}…
            </p>
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
          {missionHeader}
          <h2 className="mt-2 font-display text-2xl italic">Vote on the proposed team.</h2>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            Proposed team
          </p>
          <ul className="mt-1 space-y-1 text-sm text-fg">
            {state.teamIds.map((id) => (
              <li key={id} className="font-display italic">
                · {findName(id)}
              </li>
            ))}
          </ul>
          {myVote ? (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Voted {myVote === "up" ? "APPROVE" : "REJECT"}. {votedCount} / {state.playerOrder.length} in.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => dispatch({ type: "vote", choice: "up" })}
                className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "vote", choice: "down" })}
                className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
              >
                Reject
              </button>
            </div>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "vote-result") {
    const ups = Object.values(state.votes).filter((v) => v === "up").length;
    const downs = state.playerOrder.length - ups;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          {missionHeader}
          <h2 className={`mt-2 font-display text-4xl italic ${state.approved ? "text-[hsl(var(--ember))]" : "text-[#b94a4a]"}`}>
            {state.approved ? "Approved." : "Rejected."}
          </h2>
          <p className="mt-2 text-xs text-muted">
            {ups} up · {downs} down
          </p>
          <ul className="mt-4 space-y-1 text-sm">
            {state.playerOrder.map((id) => (
              <li key={id} className="flex items-baseline justify-between">
                <span className="font-display italic text-fg">{findName(id)}</span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                    state.votes[id] === "up" ? "text-[hsl(var(--ember))]" : "text-muted"
                  }`}
                >
                  {state.votes[id]}
                </span>
              </li>
            ))}
          </ul>
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "continue" })}
              className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              {state.approved ? "Begin mission →" : `Next leader (streak ${state.rejectStreak + 1}/5) →`}
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "mission-play") {
    const iAmOnTeam = state.teamIds.includes(me);
    const myRole = state.roles[me];
    const myPlay = state.plays[me];
    const inCount = Object.keys(state.plays).length;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          {missionHeader}
          <h2 className="mt-2 font-display text-2xl italic">Mission in progress.</h2>
          <p className="mt-2 text-xs text-muted">
            Team: {state.teamIds.map(findName).join(", ")}
          </p>
          {iAmOnTeam ? (
            myPlay ? (
              <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
                Played. Waiting for the rest of the team. ({inCount} / {state.teamIds.length} in)
              </p>
            ) : (
              <div className="mt-6">
                <p className="text-xs text-muted">
                  Play your card (private). {myRole === "resistance" ? "Resistance must play Success." : "You may Fail."}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "play", choice: "success" })}
                    className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
                  >
                    Success
                  </button>
                  <button
                    type="button"
                    disabled={myRole !== "spy"}
                    onClick={() => dispatch({ type: "play", choice: "fail" })}
                    className="rounded-md border border-[#b94a4a]/60 py-3 font-mono text-[11px] uppercase tracking-wider text-[#b94a4a] disabled:opacity-30"
                  >
                    Fail
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Not on this mission. Waiting. ({inCount} / {state.teamIds.length} played)
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "mission-result") {
    const needsTwo = missionNeeds2Fails(state.playerOrder.length, state.mission);
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          {missionHeader}
          <h2 className={`mt-2 font-display text-4xl italic ${state.success ? "text-[hsl(var(--ember))]" : "text-[#b94a4a]"}`}>
            {state.success ? "Mission succeeded." : "Mission failed."}
          </h2>
          <p className="mt-2 text-xs text-muted">
            {state.failCount} fail{state.failCount === 1 ? "" : "s"} played
            {needsTwo ? " (needed 2 to fail this mission)" : ""}.
          </p>
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "continue" })}
              className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              Continue →
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  return null;
};

// ─── subcomponents ───────────────────────────────────────────────────

function LeaderTeamPicker({
  playerOrder,
  needed,
  findName,
  onSubmit,
}: {
  playerOrder: string[];
  needed: number;
  findName: (id: string) => string;
  onSubmit: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= needed) return prev;
      return [...prev, id];
    });
  };
  return (
    <div className="mt-4">
      <p className="text-xs text-muted">Pick {needed - picked.length} more player{needed - picked.length === 1 ? "" : "s"}.</p>
      <ul className="mt-3 space-y-1.5">
        {playerOrder.map((id) => {
          const on = picked.includes(id);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => toggle(id)}
                className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  on
                    ? "border-[hsl(var(--ember)/0.7)] bg-[hsl(var(--ember)/0.12)] text-fg"
                    : "border-border bg-bg/40 text-fg hover:border-[hsl(var(--ember)/0.5)]"
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
        disabled={picked.length !== needed}
        onClick={() => onSubmit(picked)}
        className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-40"
      >
        Propose team →
      </button>
    </div>
  );
}

function MissionPips({ missions }: { missions: Array<{ success: boolean }> }) {
  return (
    <span className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const m = missions[i];
        const bg = m ? (m.success ? "bg-[hsl(var(--ember))]" : "bg-[#b94a4a]") : "bg-border";
        return <span key={i} className={`h-2 w-4 rounded-sm ${bg}`} />;
      })}
    </span>
  );
}

function EndControls({
  isHost,
  onPlayAgain,
  onQuit,
}: {
  isHost: boolean;
  onPlayAgain: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="mt-8 flex gap-3">
      {isHost ? (
        <button
          type="button"
          onClick={onPlayAgain}
          className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
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
        className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted"
      >
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

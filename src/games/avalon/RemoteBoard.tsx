"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { ROLES } from "./roles";
import {
  TEAM_SIZES,
  failsNeeded,
  type AvalonRemoteState,
  type AvalonRemoteAction,
} from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const AvalonRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as AvalonRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: AvalonRemoteAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + ("mission" in state ? `-m${state.mission}` : "") : "loading");

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const winnerIds = Object.entries(state.roles)
      .filter(([, r]) => ROLES[r].team === state.winner)
      .map(([id]) => id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [
        `${state.winner === "good" ? "Good" : "Evil"} won`,
        state.assassinGuess
          ? state.assassinGuess.correct
            ? "Assassin named Merlin correctly"
            : "Assassin missed Merlin"
          : "",
      ].filter(Boolean),
    });
  }, [isHost, state, players, onComplete, startedAt]);

  if (!state) {
    return (
      <section className="mx-auto max-w-md pt-20 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[hsl(var(--ember))]" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Dealing roles…</p>
      </section>
    );
  }

  const findName = (peerId: string) => players.find((p) => p.id === peerId)?.name ?? "?";

  // ────────── REVEAL ──────────
  if (state.kind === "reveal") {
    const myRoleId = state.roles[me];
    const myRole = myRoleId ? ROLES[myRoleId] : null;
    const confirmedCount = Object.keys(state.confirmed).length;
    const iConfirmed = !!state.confirmed[me];

    // Merlin sees evil; evil sees other evil.
    const evilIds = Object.entries(state.roles)
      .filter(([, r]) => ROLES[r].team === "evil")
      .map(([id]) => id);
    let intel: string | null = null;
    if (myRoleId === "merlin") intel = `Evil players: ${evilIds.map(findName).join(", ")}`;
    else if (myRole?.team === "evil") {
      const others = evilIds.filter((id) => id !== me);
      intel = others.length > 0 ? `Fellow evil: ${others.map(findName).join(", ")}` : null;
    }

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
                className="mt-4 rounded-lg border p-5"
                style={{ borderColor: myRole.accent, background: `${myRole.accent}14` }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: myRole.accent }}>
                  You are
                </p>
                <h2 className="mt-1 font-display text-4xl italic" style={{ color: myRole.accent }}>
                  {myRole.name}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-fg">{myRole.description}</p>
                {intel && <p className="mt-3 text-xs text-muted">{intel}</p>}
                <button
                  type="button"
                  onClick={() => dispatch({ type: "confirm-role" })}
                  className="mt-5 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg"
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
    const accent = state.winner === "good" ? "text-[hsl(var(--ember))]" : "text-[#b94a4a]";
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
          <h2 className={`mt-2 font-display text-5xl italic ${accent}`}>
            {state.winner === "good" ? "Good prevails." : "Evil wins."}
          </h2>
          {state.assassinGuess && (
            <p className="mt-3 text-sm text-muted">
              Assassin named {findName(state.assassinGuess.targetId)} as Merlin —{" "}
              {state.assassinGuess.correct ? "correct." : "wrong."}
            </p>
          )}
          <div className="mt-8 rounded-md border border-border bg-bg/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Roles</p>
            <ul className="mt-2 divide-y divide-border/50">
              {state.playerOrder.map((id) => {
                const role = ROLES[state.roles[id]];
                return (
                  <li key={id} className="flex items-baseline justify-between py-1.5">
                    <span className="font-display italic text-fg">{findName(id)}</span>
                    <span className="font-mono text-xs" style={{ color: role.accent }}>
                      {role.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <EndControls isHost={isHost} onPlayAgain={() => { completedRef.current = false; dispatch({ type: "play-again" }); }} onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "assassin-guess") {
    const iAmAssassin = state.roles[me] === "assassin";
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(340_75%_60%)]">Assassin's chance</p>
          <h2 className="mt-2 font-display text-3xl italic">Good won three quests. One shot remains.</h2>
          <p className="mt-3 text-sm text-muted">
            The Assassin names one player as Merlin. Correct guess flips the win to Evil.
          </p>
          {iAmAssassin ? (
            <ul className="mt-4 space-y-1.5">
              {state.playerOrder
                .filter((id) => ROLES[state.roles[id]].team === "good")
                .map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "assassin-pick", targetId: id })}
                      className="block w-full rounded-md border border-border bg-bg/40 px-3 py-2 text-left text-sm text-fg hover:border-[hsl(340_75%_60%)/0.5]"
                    >
                      {findName(id)}
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              Waiting for the Assassin to guess…
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  const missionHeader = (
    <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
      <span className="text-muted">Quest {state.mission + 1} / 5</span>
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
            {iAmLeader ? `Pick a quest team of ${needed}` : `${leaderName} is picking a team of ${needed}`}
          </h2>
          <p className="mt-1 text-xs text-muted">Reject streak: {state.rejectStreak} / 5.</p>
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
          <ul className="mt-3 space-y-1 text-sm text-fg">
            {state.teamIds.map((id) => (
              <li key={id} className="font-display italic">· {findName(id)}</li>
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
              {state.approved ? "Begin quest →" : `Next leader (streak ${state.rejectStreak + 1}/5) →`}
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "mission-play") {
    const iAmOnTeam = state.teamIds.includes(me);
    const myRoleId = state.roles[me];
    const myRole = myRoleId ? ROLES[myRoleId] : null;
    const myPlay = state.plays[me];
    const inCount = Object.keys(state.plays).length;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          {missionHeader}
          <h2 className="mt-2 font-display text-2xl italic">Quest in progress.</h2>
          <p className="mt-2 text-xs text-muted">
            Team: {state.teamIds.map(findName).join(", ")}
          </p>
          {iAmOnTeam ? (
            myPlay ? (
              <p className="mt-6 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
                Played. Waiting. ({inCount} / {state.teamIds.length} in)
              </p>
            ) : (
              <div className="mt-6">
                <p className="text-xs text-muted">
                  Play your card (private). {myRole?.team === "good" ? "Good must play Success." : "You may Fail."}
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
                    disabled={myRole?.team !== "evil"}
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
              Not on this quest. ({inCount} / {state.teamIds.length} played)
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  if (state.kind === "mission-result") {
    const needed = failsNeeded(state.playerOrder.length, state.mission + 1);
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          {missionHeader}
          <h2 className={`mt-2 font-display text-4xl italic ${state.success ? "text-[hsl(var(--ember))]" : "text-[#b94a4a]"}`}>
            {state.success ? "Quest succeeded." : "Quest failed."}
          </h2>
          <p className="mt-2 text-xs text-muted">
            {state.failCount} fail{state.failCount === 1 ? "" : "s"} played (needed {needed} to fail).
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
      <p className="text-xs text-muted">Pick {needed - picked.length} more knight{needed - picked.length === 1 ? "" : "s"}.</p>
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

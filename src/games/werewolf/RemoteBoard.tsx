"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GameComponentProps, RemoteContext } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { playCue, WEREWOLF_CUES } from "@/lib/narrator";
import { ROLES } from "./roles";
import { type WWRemoteState, type WWExtendedAction } from "./remote";

interface Props extends GameComponentProps {
  remote: RemoteContext;
}

export const WerewolfRemoteBoard: React.FC<Props> = ({ players, remote, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const state = remote.state as WWRemoteState | null | undefined;
  const me = remote.myPeerId;
  const isHost = remote.isHost;
  const dispatch = remote.dispatch as (a: WWExtendedAction) => void;
  const completedRef = useRef(false);

  useScrollToTop(state ? state.kind + ("round" in state ? `-r${state.round}` : "") : "loading");

  useEffect(() => {
    if (!state) return;
    if (state.kind === "night") playCue(WEREWOLF_CUES.nightIntro);
    else if (state.kind === "day-resolve") playCue(state.killedId ? WEREWOLF_CUES.dayKilled : WEREWOLF_CUES.daySafe);
    else if (state.kind === "day-vote") playCue(WEREWOLF_CUES.dayVote);
    else if (state.kind === "day-voted-out")
      playCue(state.eliminatedId ? WEREWOLF_CUES.dayVotedOut : WEREWOLF_CUES.dayTie);
    else if (state.kind === "end")
      playCue(state.winningTeam === "village" ? WEREWOLF_CUES.villageWins : WEREWOLF_CUES.wolvesWin);
  }, [state]);

  useEffect(() => {
    if (!isHost || !state || state.kind !== "end") return;
    if (completedRef.current) return;
    completedRef.current = true;
    const winnerIds = state.players
      .filter((p) => (state.winningTeam === "village" ? p.role !== "werewolf" : p.role === "werewolf"))
      .map((p) => p.peerId);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [
        `${state.winningTeam === "village" ? "Villagers" : "Werewolves"} won`,
      ],
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

  const findName = (peerId: string) => state.players.find((p) => p.peerId === peerId)?.name ?? "?";
  const myPlayer = state.players.find((p) => p.peerId === me);

  // ────────── REVEAL ──────────
  if (state.kind === "reveal") {
    const myRole = myPlayer ? ROLES[myPlayer.role] : null;
    const confirmedCount = Object.keys(state.confirmed).length;
    const totalPlayers = state.players.length;
    const allConfirmed = confirmedCount >= totalPlayers;
    const iConfirmed = !!state.confirmed[me];

    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
            Role reveal
          </p>
          {myRole && myPlayer ? (
            iConfirmed ? (
              <div className="mt-4 rounded-lg border border-border bg-bg/40 p-5 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Noted</p>
                <p className="mt-2 font-display text-2xl italic">Waiting for the rest of the table…</p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
                  {confirmedCount} / {totalPlayers} ready
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
            <p className="mt-4 text-sm text-muted">Joining this round as a spectator.</p>
          )}
          {isHost && (
            <button
              type="button"
              disabled={!allConfirmed}
              onClick={() => dispatch({ type: "start-night" })}
              className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {allConfirmed ? "Begin night 1 →" : `Waiting (${confirmedCount}/${totalPlayers})`}
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // ────────── END ──────────
  if (state.kind === "end") {
    const accent = state.winningTeam === "village" ? "text-[hsl(var(--ember))]" : "text-[#b94a4a]";
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Final verdict</p>
          <h2 className={`mt-2 font-display text-5xl italic ${accent}`}>
            {state.winningTeam === "village" ? "Villagers win." : "Werewolves win."}
          </h2>
          <div className="mt-8 rounded-md border border-border bg-bg/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Roles</p>
            <ul className="mt-2 divide-y divide-border/50">
              {state.players.map((p) => {
                const role = ROLES[p.role];
                return (
                  <li key={p.peerId} className="flex items-baseline justify-between py-1.5">
                    <span className="font-display italic text-fg">
                      {p.name} {p.alive ? "" : "†"}
                    </span>
                    <span className="font-mono text-xs" style={{ color: role.accent }}>
                      {role.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-8 flex gap-3">
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

  // ────────── NIGHT ──────────
  if (state.kind === "night") {
    const alive = state.players.filter((p) => p.alive);
    const myRole = myPlayer ? ROLES[myPlayer.role] : null;
    const iAmAlive = !!myPlayer?.alive;

    // Only wolves see wolf-votes; seer/doctor see their own prompt.
    const renderRolePrompt = () => {
      if (!iAmAlive || !myPlayer || !myRole) return null;
      if (myPlayer.role === "werewolf") {
        const myVote = state.wolfVotes[me];
        const fellowWolves = alive.filter((p) => p.role === "werewolf");
        const targets = alive.filter((p) => p.role !== "werewolf");
        return (
          <div className="mt-4 rounded-lg border border-[hsl(0_70%_55%/0.5)] bg-[hsl(0_70%_55%/0.08)] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(0_70%_55%)]">Wolves</p>
            <p className="mt-1 text-xs text-muted">
              Your pack: {fellowWolves.map((w) => w.name).join(", ")}
            </p>
            <p className="mt-3 text-sm">Pick who to eliminate. Majority wins; ties broken at random.</p>
            <ul className="mt-3 space-y-1.5">
              {targets.map((t) => {
                const votesForT = Object.entries(state.wolfVotes).filter(([, v]) => v === t.peerId).map(([w]) => w);
                return (
                  <li key={t.peerId}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "wolf-vote", targetId: t.peerId })}
                      className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        myVote === t.peerId
                          ? "border-[hsl(0_70%_55%/0.7)] bg-[hsl(0_70%_55%/0.18)] text-fg"
                          : "border-border bg-bg/40 text-fg hover:border-[hsl(0_70%_55%/0.5)]"
                      }`}
                    >
                      <div className="flex items-baseline justify-between">
                        <span>{t.name}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                          {votesForT.length > 0 ? `${votesForT.length} vote${votesForT.length === 1 ? "" : "s"}` : ""}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => dispatch({ type: "wolf-vote", targetId: null })}
              className="mt-3 w-full rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
            >
              Abstain
            </button>
          </div>
        );
      }
      if (myPlayer.role === "seer") {
        const mySub = state.seerSubmissions[me];
        const targets = alive.filter((p) => p.peerId !== me);
        return (
          <div className="mt-4 rounded-lg border border-[hsl(210_80%_65%/0.5)] bg-[hsl(210_80%_65%/0.08)] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(210_80%_65%)]">Seer</p>
            <p className="mt-1 text-sm">Pick someone to check. You&apos;ll learn their team.</p>
            <ul className="mt-3 space-y-1.5">
              {targets.map((t) => (
                <li key={t.peerId}>
                  <button
                    type="button"
                    disabled={mySub !== undefined}
                    onClick={() => dispatch({ type: "seer-check", targetId: t.peerId })}
                    className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      mySub === t.peerId
                        ? "border-[hsl(210_80%_65%/0.7)] bg-[hsl(210_80%_65%/0.18)] text-fg"
                        : "border-border bg-bg/40 text-fg hover:border-[hsl(210_80%_65%/0.5)] disabled:opacity-40"
                    }`}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
            {mySub === undefined && (
              <button
                type="button"
                onClick={() => dispatch({ type: "seer-check", targetId: null })}
                className="mt-3 w-full rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
              >
                Skip
              </button>
            )}
            {mySub !== undefined && (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Submitted — waiting for dawn.</p>
            )}
          </div>
        );
      }
      if (myPlayer.role === "doctor") {
        const mySub = state.doctorSubmissions[me];
        const targets = alive;
        return (
          <div className="mt-4 rounded-lg border border-[hsl(140_60%_55%/0.5)] bg-[hsl(140_60%_55%/0.08)] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(140_60%_55%)]">Doctor</p>
            <p className="mt-1 text-sm">Pick someone to protect tonight.</p>
            {myPlayer.doctorSelfProtectUsed && (
              <p className="mt-1 text-xs text-muted">(Self-protect already used.)</p>
            )}
            <ul className="mt-3 space-y-1.5">
              {targets.map((t) => {
                const isSelf = t.peerId === me;
                const selfBlocked = isSelf && myPlayer.doctorSelfProtectUsed;
                return (
                  <li key={t.peerId}>
                    <button
                      type="button"
                      disabled={mySub !== undefined || selfBlocked}
                      onClick={() => dispatch({ type: "doctor-protect", targetId: t.peerId })}
                      className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        mySub === t.peerId
                          ? "border-[hsl(140_60%_55%/0.7)] bg-[hsl(140_60%_55%/0.18)] text-fg"
                          : "border-border bg-bg/40 text-fg hover:border-[hsl(140_60%_55%/0.5)] disabled:opacity-40"
                      }`}
                    >
                      {t.name} {isSelf ? "(you)" : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
            {mySub === undefined && (
              <button
                type="button"
                onClick={() => dispatch({ type: "doctor-protect", targetId: null })}
                className="mt-3 w-full rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
              >
                Skip
              </button>
            )}
            {mySub !== undefined && (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Submitted — waiting for dawn.</p>
            )}
          </div>
        );
      }
      return (
        <div className="mt-4 rounded-lg border border-border bg-bg/40 p-4 text-center text-sm text-muted">
          The night passes. Close your eyes.
        </div>
      );
    };

    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Night {state.round}</p>
          <h2 className="mt-2 font-display text-3xl italic">It is night. {iAmAlive ? "Act in private." : "You are gone."}</h2>
          {renderRolePrompt()}
        </section>
      </RoomCodeBar>
    );
  }

  // ────────── DAY-RESOLVE ──────────
  if (state.kind === "day-resolve") {
    const killed = state.killedId ? findName(state.killedId) : null;
    const mySeerRead = state.seerReads.find((r) => r.seerId === me);
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Dawn · night {state.round}</p>
          {killed ? (
            <>
              <h2 className="mt-2 font-display text-4xl italic text-[#b94a4a]">{killed} is gone.</h2>
              <p className="mt-3 text-sm text-muted">Found in the square. The wolves struck.</p>
            </>
          ) : (
            <>
              <h2 className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">Everyone&apos;s here.</h2>
              <p className="mt-3 text-sm text-muted">Either the wolves abstained or the doctor intervened.</p>
            </>
          )}
          {mySeerRead && (
            <div
              className="mt-6 rounded-lg border border-[hsl(210_80%_65%/0.5)] bg-[hsl(210_80%_65%/0.08)] p-4 text-left"
              key={mySeerRead.targetId}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(210_80%_65%)]">Seer — private</p>
              <p className="mt-1 font-display text-xl italic">
                {findName(mySeerRead.targetId)} is on the <span className="font-bold">{mySeerRead.team}</span> team.
              </p>
            </div>
          )}
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "start-day-vote" })}
              className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Open discussion · start vote →
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // ────────── DAY-VOTE ──────────
  if (state.kind === "day-vote") {
    const alive = state.players.filter((p) => p.alive);
    const iAmAlive = !!myPlayer?.alive;
    const myVote = state.votes[me];
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Day {state.round} · vote</p>
          <h2 className="mt-2 font-display text-3xl italic">Vote someone out.</h2>
          <p className="mt-2 text-xs text-muted">
            {Object.keys(state.votes).length} / {alive.length} voted
          </p>
          {iAmAlive ? (
            <ul className="mt-4 space-y-1.5">
              {alive.map((p) => (
                <li key={p.peerId}>
                  <button
                    type="button"
                    disabled={p.peerId === me}
                    onClick={() => dispatch({ type: "day-vote", targetId: p.peerId })}
                    className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      myVote === p.peerId
                        ? "border-[hsl(var(--ember)/0.7)] bg-[hsl(var(--ember)/0.12)] text-fg"
                        : "border-border bg-bg/40 text-fg hover:border-[hsl(var(--ember)/0.5)] disabled:opacity-40"
                    }`}
                  >
                    {p.name} {p.peerId === me ? "(you)" : ""}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-border bg-bg/30 px-3 py-3 text-center text-sm text-muted">
              You&apos;re out. Watching the rest.
            </p>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  // ────────── DAY-VOTED-OUT ──────────
  if (state.kind === "day-voted-out") {
    const name = state.eliminatedId ? findName(state.eliminatedId) : null;
    const role = state.eliminatedId
      ? state.players.find((p) => p.peerId === state.eliminatedId)?.role
      : null;
    return (
      <RoomCodeBar code={remote.code}>
        <section className="mx-auto max-w-md animate-fade-up text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict · day {state.round}</p>
          {name ? (
            <>
              <h2 className="mt-2 font-display text-4xl italic">{name} is cast out.</h2>
              <p className="mt-3 text-sm text-muted">
                They were the <span className="text-[hsl(var(--ember))]">{role ? ROLES[role].name : "?"}</span>.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-2 font-display text-4xl italic">Tied vote.</h2>
              <p className="mt-3 text-sm text-muted">No one is eliminated.</p>
            </>
          )}
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: "continue" })}
              className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
            >
              Night falls again →
            </button>
          )}
          <QuitButton onQuit={onQuit} />
        </section>
      </RoomCodeBar>
    );
  }

  return null;
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

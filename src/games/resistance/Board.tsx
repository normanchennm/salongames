"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { RoleArt } from "@/components/RoleArt";
import { EndScreenArt } from "@/components/EndScreenArt";
import { playCue, RESISTANCE_CUES } from "@/lib/narrator";
import { ResistanceRemoteBoard } from "./RemoteBoard";

/** The Resistance — 5-10 player hidden-team mission game.
 *
 *  2-4 Spies, rest are Resistance. Leader rotates, proposes a team of N
 *  per mission. All vote up/down. On approval, team members secretly
 *  play SUCCESS or FAIL. Any FAIL sinks the mission (except mission 4
 *  with 7+ players needs 2 FAILs). 3 successes = Resistance win.
 *  3 failures or 5 consecutive rejected proposals on one mission
 *  = Spies win. */

const SPY_COUNT: Record<number, number> = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
const TEAM_SIZES: Record<number, number[]> = {
  5:  [2, 3, 2, 3, 3],
  6:  [2, 3, 4, 3, 4],
  7:  [2, 3, 3, 4, 4],
  8:  [3, 4, 4, 5, 5],
  9:  [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};
function missionNeeds2Fails(players: number, mission: number): boolean {
  return players >= 7 && mission === 3; // mission index 3 (round 4)
}

type Role = "resistance" | "spy";
interface Roles { [playerId: string]: Role; }

interface MissionRecord { success: boolean; failCount: number; }

type Phase =
  | { kind: "intro" }
  | { kind: "role-pass"; playerIdx: number }
  | { kind: "role-reveal"; playerIdx: number }
  | { kind: "mission-intro"; mission: number; leaderIdx: number; rejectStreak: number; missions: MissionRecord[] }
  | { kind: "team-select"; mission: number; leaderIdx: number; rejectStreak: number; missions: MissionRecord[]; teamIds: string[] }
  | { kind: "vote-pass"; mission: number; leaderIdx: number; rejectStreak: number; missions: MissionRecord[]; teamIds: string[]; voterIdx: number; votes: Record<string, "up" | "down"> }
  | { kind: "vote-input"; mission: number; leaderIdx: number; rejectStreak: number; missions: MissionRecord[]; teamIds: string[]; voterIdx: number; votes: Record<string, "up" | "down"> }
  | { kind: "vote-result"; mission: number; leaderIdx: number; rejectStreak: number; missions: MissionRecord[]; teamIds: string[]; votes: Record<string, "up" | "down"> }
  | { kind: "mission-pass"; mission: number; leaderIdx: number; rejectStreak: number; missions: MissionRecord[]; teamIds: string[]; teamIdx: number; plays: Record<string, "success" | "fail"> }
  | { kind: "mission-input"; mission: number; leaderIdx: number; rejectStreak: number; missions: MissionRecord[]; teamIds: string[]; teamIdx: number; plays: Record<string, "success" | "fail"> }
  | { kind: "mission-result"; mission: number; leaderIdx: number; rejectStreak: number; missions: MissionRecord[]; teamIds: string[]; plays: Record<string, "success" | "fail">; success: boolean; failCount: number }
  | { kind: "end"; winner: "resistance" | "spies"; roles: Roles; missions: MissionRecord[] };

function assignRoles(players: { id: string }[]): Roles {
  const spyN = SPY_COUNT[players.length];
  const shuffled = players.map((p) => p.id);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const roles: Roles = {};
  shuffled.forEach((id, i) => { roles[id] = i < spyN ? "spy" : "resistance"; });
  return roles;
}

export const ResistanceBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <ResistanceRemoteBoard {...props} remote={props.remote} />;
  return <ResistanceLocalBoard {...props} />;
};

const ResistanceLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [roles, setRoles] = useState<Roles>({});
  useScrollToTop(phase.kind + ("mission" in phase ? `-m${phase.mission}` : "") + ("voterIdx" in phase ? `-v${phase.voterIdx}` : "") + ("teamIdx" in phase ? `-t${phase.teamIdx}` : ""));

  useEffect(() => {
    if (phase.kind === "vote-result") {
      const ups = Object.values(phase.votes).filter((v) => v === "up").length;
      const approved = ups > players.length - ups;
      playCue(approved ? RESISTANCE_CUES.proposalApproved : RESISTANCE_CUES.proposalRejected);
    }
    else if (phase.kind === "mission-result") playCue(phase.success ? RESISTANCE_CUES.missionSuccess : RESISTANCE_CUES.missionFail);
    else if (phase.kind === "end") playCue(phase.winner === "resistance" ? RESISTANCE_CUES.resistanceWins : RESISTANCE_CUES.spiesWin);
  }, [phase]);

  if (players.length < 5 || players.length > 10) {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Needs 5-10 players</p>
        <button type="button" onClick={onQuit} className="mt-8 w-full rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Back</button>
      </section>
    );
  }

  const teamSizes = TEAM_SIZES[players.length];

  // --- INTRO ----------------------------------------------------
  if (phase.kind === "intro") {
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">How it works</p>
        <h2 className="mt-2 font-display text-3xl italic">Five missions. Three to win.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Each mission: leader proposes a team, table votes up or down. On approval, team members secretly play success or fail. One fail sinks the mission (mission 4 needs two with 7+ players). 3 successes = Resistance wins. 3 fails = Spies win.
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase text-muted">
          {SPY_COUNT[players.length]} spy/ies among {players.length} players.
        </p>
        <button
          type="button"
          onClick={() => {
            const r = assignRoles(players);
            setRoles(r);
            setPhase({ kind: "role-pass", playerIdx: 0 });
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Deal roles →
        </button>
        <button type="button" onClick={onQuit} className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Quit</button>
      </section>
    );
  }

  // --- ROLE REVEAL ---------------------------------------------
  if (phase.kind === "role-pass") {
    const p = players[phase.playerIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Role reveal {phase.playerIdx + 1} / {players.length}</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {p.name}.</h2>
        <button type="button" onClick={() => setPhase({ kind: "role-reveal", playerIdx: phase.playerIdx })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          I&apos;m {p.name} — reveal →
        </button>
      </section>
    );
  }
  if (phase.kind === "role-reveal") {
    const p = players[phase.playerIdx];
    const role = roles[p.id];
    const isSpy = role === "spy";
    const spyNames = isSpy ? players.filter((pl) => roles[pl.id] === "spy" && pl.id !== p.id).map((pl) => pl.name) : [];
    const nextIdx = phase.playerIdx + 1;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{p.name}, you are</p>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-6 py-8">
          <RoleArt game="resistance" role={isSpy ? "spy" : "resistance"} fallback={["#2a1a2a", "#100d0b"]} className="aspect-[4/3] w-full mb-4" />
          <h2 className="font-display text-4xl italic text-[hsl(var(--ember))]">{isSpy ? "Spy" : "Resistance"}</h2>
          {isSpy && spyNames.length > 0 && (
            <p className="mt-3 text-sm text-muted">Your fellow spies: <span className="text-fg">{spyNames.join(", ")}</span></p>
          )}
          {isSpy && spyNames.length === 0 && (
            <p className="mt-3 text-sm text-muted">You are the lone spy.</p>
          )}
          {!isSpy && <p className="mt-3 text-sm text-muted">Trust no one. Not even yourself.</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            if (nextIdx >= players.length) {
              setPhase({ kind: "mission-intro", mission: 0, leaderIdx: 0, rejectStreak: 0, missions: [] });
            } else {
              setPhase({ kind: "role-pass", playerIdx: nextIdx });
            }
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {nextIdx >= players.length ? "Begin mission 1 →" : "Hide & pass →"}
        </button>
      </section>
    );
  }

  // --- MISSION INTRO -------------------------------------------
  if (phase.kind === "mission-intro") {
    const leader = players[phase.leaderIdx];
    const tSize = teamSizes[phase.mission];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Mission {phase.mission + 1} of 5</p>
        <h2 className="mt-2 font-display text-4xl italic">{leader.name} is leader.</h2>
        <p className="mt-3 text-sm text-muted">Team size: <span className="text-fg">{tSize}</span>.</p>
        {missionNeeds2Fails(players.length, phase.mission) && (
          <p className="mt-2 text-xs text-[hsl(var(--ember))]">This mission needs 2 fails to fail.</p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          {phase.missions.map((m, i) => (
            <div key={i} className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs ${
              m.success ? "border-[#5a9a5a] bg-[#5a9a5a]/20 text-[#5a9a5a]" : "border-[hsl(var(--ember))] bg-[hsl(var(--ember))]/20 text-[hsl(var(--ember))]"
            }`}>
              {m.success ? "✓" : "✗"}
            </div>
          ))}
          {Array.from({ length: 5 - phase.missions.length }).map((_, i) => (
            <div key={i} className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-xs text-muted">?</div>
          ))}
        </div>
        {phase.rejectStreak > 0 && (
          <p className="mt-4 font-mono text-xs text-[hsl(var(--ember))]">Rejection streak: {phase.rejectStreak} / 5</p>
        )}
        <button
          type="button"
          onClick={() => setPhase({ kind: "team-select", mission: phase.mission, leaderIdx: phase.leaderIdx, rejectStreak: phase.rejectStreak, missions: phase.missions, teamIds: [] })}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {leader.name}, build your team →
        </button>
      </section>
    );
  }

  // --- TEAM SELECT ---------------------------------------------
  if (phase.kind === "team-select") {
    const p = phase;
    const leader = players[p.leaderIdx];
    const tSize = teamSizes[p.mission];
    const toggle = (id: string) => {
      const exists = p.teamIds.includes(id);
      if (exists) setPhase({ ...p, teamIds: p.teamIds.filter((x) => x !== id) });
      else if (p.teamIds.length < tSize) setPhase({ ...p, teamIds: [...p.teamIds, id] });
    };
    const canSubmit = p.teamIds.length === tSize;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">
          {leader.name} — pick {tSize} team members (can include self)
        </p>
        <div className="mt-4 space-y-2">
          {players.map((pl) => {
            const picked = p.teamIds.includes(pl.id);
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => toggle(pl.id)}
                className={`block w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                  picked ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] text-fg" : "border-border bg-bg/40 text-fg hover:border-[hsl(var(--ember)/0.4)]"
                }`}
              >
                {pl.name} {pl.id === leader.id ? "(leader)" : ""}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => setPhase({ kind: "vote-pass", mission: p.mission, leaderIdx: p.leaderIdx, rejectStreak: p.rejectStreak, missions: p.missions, teamIds: p.teamIds, voterIdx: 0, votes: {} })}
          className="mt-6 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Propose this team →
        </button>
      </section>
    );
  }

  // --- VOTE -----------------------------------------------------
  if (phase.kind === "vote-pass") {
    const voter = players[phase.voterIdx];
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Vote {phase.voterIdx + 1} / {players.length}</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {voter.name}.</h2>
        <button type="button" onClick={() => setPhase({ ...phase, kind: "vote-input" })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          I&apos;m {voter.name} — show proposal →
        </button>
      </section>
    );
  }
  if (phase.kind === "vote-input") {
    const p = phase;
    const voter = players[p.voterIdx];
    const teamNames = p.teamIds.map((id) => players.find((pl) => pl.id === id)?.name).join(", ");
    const submit = (v: "up" | "down") => {
      const nextVotes = { ...p.votes, [voter.id]: v };
      const nextIdx = p.voterIdx + 1;
      if (nextIdx >= players.length) {
        setPhase({ kind: "vote-result", mission: p.mission, leaderIdx: p.leaderIdx, rejectStreak: p.rejectStreak, missions: p.missions, teamIds: p.teamIds, votes: nextVotes });
      } else {
        setPhase({ kind: "vote-pass", mission: p.mission, leaderIdx: p.leaderIdx, rejectStreak: p.rejectStreak, missions: p.missions, teamIds: p.teamIds, voterIdx: nextIdx, votes: nextVotes });
      }
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{voter.name} — private</p>
        <div className="mt-4 rounded-md border border-border bg-bg/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Proposed team</p>
          <p className="mt-1 font-display text-lg italic text-fg">{teamNames}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => submit("down")} className="rounded-md border border-border py-4 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
            Reject
          </button>
          <button type="button" onClick={() => submit("up")} className="rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
            Approve
          </button>
        </div>
      </section>
    );
  }
  if (phase.kind === "vote-result") {
    const p = phase;
    const ups = Object.values(p.votes).filter((v) => v === "up").length;
    const downs = players.length - ups;
    const approved = ups > downs;
    const next = () => {
      if (approved) {
        setPhase({ kind: "mission-pass", mission: p.mission, leaderIdx: p.leaderIdx, rejectStreak: 0, missions: p.missions, teamIds: p.teamIds, teamIdx: 0, plays: {} });
      } else {
        const newStreak = p.rejectStreak + 1;
        if (newStreak >= 5) {
          // Spies win automatically.
          setPhase({ kind: "end", winner: "spies", roles, missions: p.missions });
          return;
        }
        const nextLeader = (p.leaderIdx + 1) % players.length;
        setPhase({ kind: "mission-intro", mission: p.mission, leaderIdx: nextLeader, rejectStreak: newStreak, missions: p.missions });
      }
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Vote result</p>
        <h2 className={`mt-2 font-display text-4xl italic ${approved ? "text-[hsl(var(--ember))]" : "text-muted"}`}>
          {approved ? "Approved." : "Rejected."}
        </h2>
        <p className="mt-2 text-sm text-muted">{ups} up · {downs} down</p>
        <div className="mt-4 rounded-md border border-border bg-bg/40 p-3">
          <ul className="space-y-0.5 font-mono text-xs">
            {players.map((pl) => (
              <li key={pl.id} className="flex justify-between">
                <span className="text-fg">{pl.name}</span>
                <span className={p.votes[pl.id] === "up" ? "text-[hsl(var(--ember))]" : "text-muted"}>{p.votes[pl.id] === "up" ? "approve" : "reject"}</span>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={next} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          {approved ? "Start mission →" : `New proposal (${p.rejectStreak + 1}/5) →`}
        </button>
      </section>
    );
  }

  // --- MISSION PLAY --------------------------------------------
  if (phase.kind === "mission-pass") {
    const p = phase;
    const teamMemberId = p.teamIds[p.teamIdx];
    const member = players.find((pl) => pl.id === teamMemberId)!;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Mission play {p.teamIdx + 1} / {p.teamIds.length}</p>
        <h2 className="mt-6 font-display text-4xl italic">Pass to {member.name}.</h2>
        <button type="button" onClick={() => setPhase({ ...p, kind: "mission-input" })} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          I&apos;m {member.name} — play card →
        </button>
      </section>
    );
  }
  if (phase.kind === "mission-input") {
    const p = phase;
    const teamMemberId = p.teamIds[p.teamIdx];
    const member = players.find((pl) => pl.id === teamMemberId)!;
    const isSpy = roles[member.id] === "spy";
    const submit = (card: "success" | "fail") => {
      if (card === "fail" && !isSpy) return; // resistance cannot fail
      const nextPlays = { ...p.plays, [member.id]: card };
      const nextIdx = p.teamIdx + 1;
      if (nextIdx >= p.teamIds.length) {
        // Resolve mission.
        const failCount = Object.values(nextPlays).filter((v) => v === "fail").length;
        const need2 = missionNeeds2Fails(players.length, p.mission);
        const success = need2 ? failCount < 2 : failCount === 0;
        setPhase({ kind: "mission-result", mission: p.mission, leaderIdx: p.leaderIdx, rejectStreak: p.rejectStreak, missions: p.missions, teamIds: p.teamIds, plays: nextPlays, success, failCount });
      } else {
        setPhase({ kind: "mission-pass", mission: p.mission, leaderIdx: p.leaderIdx, rejectStreak: p.rejectStreak, missions: p.missions, teamIds: p.teamIds, teamIdx: nextIdx, plays: nextPlays });
      }
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">{member.name} — private</p>
        <h2 className="mt-2 font-display text-2xl italic">Play your mission card.</h2>
        <p className="mt-2 text-xs text-muted">
          {isSpy ? "You may play Success or Fail." : "Resistance must play Success."}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => submit("success")} className="rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
            Success
          </button>
          <button type="button" onClick={() => submit("fail")} disabled={!isSpy} className="rounded-md border border-border py-4 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg disabled:opacity-40">
            Fail
          </button>
        </div>
      </section>
    );
  }
  if (phase.kind === "mission-result") {
    const p = phase;
    const successes = p.missions.filter((m) => m.success).length + (p.success ? 1 : 0);
    const failures = p.missions.filter((m) => !m.success).length + (p.success ? 0 : 1);
    const next = () => {
      const nextMissions = [...p.missions, { success: p.success, failCount: p.failCount }];
      if (successes >= 3) { setPhase({ kind: "end", winner: "resistance", roles, missions: nextMissions }); return; }
      if (failures >= 3) { setPhase({ kind: "end", winner: "spies", roles, missions: nextMissions }); return; }
      const nextLeader = (p.leaderIdx + 1) % players.length;
      setPhase({ kind: "mission-intro", mission: p.mission + 1, leaderIdx: nextLeader, rejectStreak: 0, missions: nextMissions });
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Mission {p.mission + 1}</p>
        <h2 className={`mt-2 font-display text-4xl italic ${p.success ? "text-[#5a9a5a]" : "text-[hsl(var(--ember))]"}`}>
          {p.success ? "Success." : "Failure."}
        </h2>
        <p className="mt-2 text-sm text-muted">{p.failCount} fail card{p.failCount === 1 ? "" : "s"} played.</p>
        <button type="button" onClick={next} className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Continue →
        </button>
      </section>
    );
  }

  // --- END ------------------------------------------------------
  const winnerTeam = phase.winner;
  const winnerIds = players.filter((p) => (winnerTeam === "resistance" ? roles[p.id] === "resistance" : roles[p.id] === "spy")).map((p) => p.id);
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <EndScreenArt game="resistance" outcome={winnerTeam === "resistance" ? "resistance-wins" : "spies-win"} fallback={["#2a1a2a", "#100d0b"]} className="aspect-[16/9] w-full mb-4" />
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Verdict</p>
      <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
        {winnerTeam === "resistance" ? "Resistance wins." : "Spies win."}
      </h2>
      <div className="mt-6 rounded-md border border-border bg-bg/40 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Roles</p>
        <ul className="mt-2 space-y-0.5 font-mono text-xs">
          {players.map((pl) => (
            <li key={pl.id} className="flex justify-between">
              <span className="text-fg">{pl.name}</span>
              <span className={roles[pl.id] === "spy" ? "text-[hsl(var(--ember))]" : "text-muted"}>{roles[pl.id]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-10 flex gap-3">
        <button type="button" onClick={() => onComplete({
          playedAt: new Date().toISOString(),
          players,
          winnerIds,
          durationSec: Math.round((Date.now() - startedAt) / 1000),
          highlights: [`${winnerTeam === "resistance" ? "Resistance" : "Spies"} wins`],
        })} className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90">
          Play again
        </button>
        <button type="button" onClick={onQuit} className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
          Back
        </button>
      </div>
    </section>
  );
};

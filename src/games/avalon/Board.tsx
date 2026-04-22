"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { ROLES, TEAM_SIZES, buildRoleMix, failsNeeded, shuffle, type RoleId } from "./roles";

/** Avalon-clone ("Knights of Camelot") — 5-10 players, quest-based
 *  social deduction.
 *
 *  Round loop (up to 5 rounds):
 *   1. Leader picks a team of N players (N per TEAM_SIZES chart)
 *   2. Team vote: every player approves / rejects, pass phone
 *      - If majority rejects, leader passes to next player
 *      - 5 rejections in a row = evil wins automatically
 *   3. Quest: team members secretly play success or fail (evil may
 *      fail, good must succeed), pass phone per team member
 *      - Majority fails (or 2 fails in round 4 of 7+ players) =
 *        quest fails
 *   4. Track: 3 successes = good phase wins; 3 fails = evil wins
 *   5. On 3 good successes, Assassin gets one guess at Merlin; if
 *      correct, evil steals the win. */

interface PlayerState {
  id: string;
  name: string;
  role: RoleId;
}

type Phase =
  | { kind: "reveal"; current: number }
  | { kind: "team-select"; leaderIndex: number; round: number; proposal: string[]; rejections: number; questResults: ("success" | "fail")[] }
  | { kind: "team-vote"; leaderIndex: number; round: number; proposal: string[]; rejections: number; questResults: ("success" | "fail")[]; votes: Record<string, "approve" | "reject"> }
  | { kind: "quest"; round: number; team: string[]; plays: Record<string, "success" | "fail">; questResults: ("success" | "fail")[]; leaderIndex: number; rejections: number }
  | { kind: "quest-resolve"; round: number; result: "success" | "fail"; failCount: number; questResults: ("success" | "fail")[]; leaderIndex: number; rejections: number }
  | { kind: "assassin-guess"; questResults: ("success" | "fail")[] }
  | { kind: "end"; winner: "good" | "evil"; reason: string };

export const AvalonBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const n = players.length;
  const assigned = useMemo<PlayerState[]>(() => {
    const roles = shuffle(buildRoleMix(n));
    return players.map((p, i) => ({ id: p.id, name: p.name, role: roles[i] }));
  }, [players, n]);

  const [phase, setPhase] = useState<Phase>({ kind: "reveal", current: 0 });
  useScrollToTop(phase.kind + ("round" in phase ? `-${phase.round}` : "") + ("current" in phase ? `-${phase.current}` : ""));

  const teamSize = (round: number) => TEAM_SIZES[n][round - 1];

  function finishGame(winner: "good" | "evil", reason: string) {
    const winnerIds = assigned
      .filter((a) => (winner === "good" ? ROLES[a.role].team === "good" : ROLES[a.role].team === "evil"))
      .map((a) => a.id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [reason],
    });
  }

  // --- REVEAL --- ------------------------------------------------
  if (phase.kind === "reveal") {
    const current = assigned[phase.current];
    const role = ROLES[current.role];
    return (
      <RevealCard
        player={current}
        role={role}
        evilTeam={
          role.team === "evil" || current.role === "merlin"
            ? assigned.filter(
                (a) =>
                  ROLES[a.role].team === "evil" &&
                  // Merlin sees evil but not the Assassin specifically
                  // (simplification — classic Avalon has Mordred hidden
                  // from Merlin; MVP skips that nuance). Minions see
                  // other minions + assassin. Assassin sees minions.
                  (current.role === "merlin" || a.id !== current.id),
              )
            : []
        }
        onPass={() => {
          const next = phase.current + 1;
          if (next >= assigned.length) {
            setPhase({
              kind: "team-select",
              leaderIndex: 0,
              round: 1,
              proposal: [],
              rejections: 0,
              questResults: [],
            });
          } else {
            setPhase({ kind: "reveal", current: next });
          }
        }}
      />
    );
  }

  // --- TEAM SELECT --- -------------------------------------------
  if (phase.kind === "team-select") {
    const leader = assigned[phase.leaderIndex % n];
    const size = teamSize(phase.round);
    const selected = new Set(phase.proposal);
    const toggle = (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else if (next.size < size) next.add(id);
      setPhase({ ...phase, proposal: Array.from(next) });
    };
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>Round {phase.round} / 5</span>
          <span>Quests: {phase.questResults.filter((r) => r === "success").length}✓ {phase.questResults.filter((r) => r === "fail").length}✗</span>
        </div>
        <h2 className="mt-3 font-display text-3xl italic">
          {leader.name} picks the team
        </h2>
        <p className="mt-2 text-sm text-muted">
          Select {size} knight{size === 1 ? "" : "s"} for this quest. The table will then vote to approve or reject the team. {phase.rejections > 0 && `${phase.rejections}/5 rejections so far — 5 in a row = evil wins.`}
        </p>
        <ul className="mt-6 space-y-2">
          {assigned.map((a) => {
            const active = selected.has(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  className={
                    "w-full rounded-md border px-4 py-3 text-left font-mono text-sm transition-colors " +
                    (active
                      ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
                      : "border-border text-fg hover:border-[hsl(var(--ember)/0.5)]")
                  }
                >
                  {a.name}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          disabled={selected.size !== size}
          onClick={() =>
            setPhase({
              kind: "team-vote",
              leaderIndex: phase.leaderIndex,
              round: phase.round,
              proposal: phase.proposal,
              rejections: phase.rejections,
              questResults: phase.questResults,
              votes: {},
            })
          }
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {selected.size === size ? "Call the vote →" : `Pick ${size - selected.size} more`}
        </button>
      </section>
    );
  }

  // --- TEAM VOTE --- ---------------------------------------------
  if (phase.kind === "team-vote") {
    const voter = assigned.find((a) => !(a.id in phase.votes));
    if (!voter) {
      const approves = Object.values(phase.votes).filter((v) => v === "approve").length;
      const passed = approves > assigned.length / 2;
      setTimeout(() => {
        if (passed) {
          setPhase({
            kind: "quest",
            round: phase.round,
            team: phase.proposal,
            plays: {},
            questResults: phase.questResults,
            leaderIndex: phase.leaderIndex,
            rejections: phase.rejections,
          });
        } else {
          const newRejections = phase.rejections + 1;
          if (newRejections >= 5) {
            setPhase({ kind: "end", winner: "evil", reason: "5 consecutive team rejections" });
          } else {
            setPhase({
              kind: "team-select",
              leaderIndex: phase.leaderIndex + 1,
              round: phase.round,
              proposal: [],
              rejections: newRejections,
              questResults: phase.questResults,
            });
          }
        }
      }, 0);
      return <LoadingCard />;
    }
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {voter.name} — vote on the team
        </p>
        <p className="mt-2 text-sm text-muted">Proposed: {phase.proposal.map((id) => assigned.find((a) => a.id === id)?.name).join(", ")}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPhase({ ...phase, votes: { ...phase.votes, [voter.id]: "reject" } })}
            className="rounded-md border border-border py-6 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => setPhase({ ...phase, votes: { ...phase.votes, [voter.id]: "approve" } })}
            className="rounded-md bg-[hsl(var(--ember))] py-6 font-mono text-xs uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Approve
          </button>
        </div>
      </section>
    );
  }

  // --- QUEST --- -------------------------------------------------
  if (phase.kind === "quest") {
    const nextPlayer = phase.team.find((id) => !(id in phase.plays));
    if (!nextPlayer) {
      const failCount = Object.values(phase.plays).filter((p) => p === "fail").length;
      const needed = failsNeeded(n, phase.round);
      const result = failCount >= needed ? "fail" : "success";
      setTimeout(
        () =>
          setPhase({
            kind: "quest-resolve",
            round: phase.round,
            result,
            failCount,
            questResults: phase.questResults,
            leaderIndex: phase.leaderIndex,
            rejections: 0,
          }),
        0,
      );
      return <LoadingCard />;
    }
    const p = assigned.find((a) => a.id === nextPlayer)!;
    const isEvil = ROLES[p.role].team === "evil";
    return (
      <QuestPlayCard
        player={p}
        canFail={isEvil}
        onPlay={(choice) => setPhase({ ...phase, plays: { ...phase.plays, [p.id]: choice } })}
      />
    );
  }

  // --- QUEST RESOLVE --- -----------------------------------------
  if (phase.kind === "quest-resolve") {
    const newResults = [...phase.questResults, phase.result];
    const successes = newResults.filter((r) => r === "success").length;
    const fails = newResults.filter((r) => r === "fail").length;
    return (
      <section className="mx-auto max-w-md animate-fade-up text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Round {phase.round} result</p>
        <h2 className={`mt-3 font-display text-5xl italic ${phase.result === "success" ? "text-[hsl(var(--ember))]" : "text-[hsl(0_70%_55%)]"}`}>
          {phase.result === "success" ? "Quest succeeded." : "Quest failed."}
        </h2>
        {phase.failCount > 0 && (
          <p className="mt-3 text-sm text-muted">{phase.failCount} fail card{phase.failCount === 1 ? "" : "s"} played.</p>
        )}
        <div className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-muted">
          <span className="text-[hsl(var(--ember))]">{successes}✓</span>
          <span className="mx-3">·</span>
          <span className="text-[hsl(0_70%_55%)]">{fails}✗</span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (successes >= 3) {
              setPhase({ kind: "assassin-guess", questResults: newResults });
            } else if (fails >= 3) {
              setPhase({ kind: "end", winner: "evil", reason: "Three quests failed" });
            } else {
              setPhase({
                kind: "team-select",
                leaderIndex: phase.leaderIndex + 1,
                round: phase.round + 1,
                proposal: [],
                rejections: 0,
                questResults: newResults,
              });
            }
          }}
          className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          {successes >= 3 ? "Good reached 3 quests — Assassin's turn →" : fails >= 3 ? "Evil wins outright →" : "Next round →"}
        </button>
      </section>
    );
  }

  // --- ASSASSIN GUESS --- ----------------------------------------
  if (phase.kind === "assassin-guess") {
    const assassin = assigned.find((a) => a.role === "assassin")!;
    const merlin = assigned.find((a) => a.role === "merlin")!;
    return (
      <section className="mx-auto max-w-md animate-fade-up">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          {assassin.name} — final guess
        </p>
        <h2 className="mt-2 font-display text-3xl italic">
          Good won three quests. Name Merlin to steal the win.
        </h2>
        <ul className="mt-6 space-y-2">
          {assigned
            .filter((a) => ROLES[a.role].team === "good")
            .map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() =>
                    setPhase({
                      kind: "end",
                      winner: a.id === merlin.id ? "evil" : "good",
                      reason:
                        a.id === merlin.id
                          ? "Assassin named Merlin correctly"
                          : `Assassin guessed ${a.name} — wrong; Merlin survives`,
                    })
                  }
                  className="w-full rounded-md border border-border px-4 py-3 text-left font-mono text-sm text-fg transition-colors hover:border-[hsl(var(--ember)/0.5)]"
                >
                  {a.name}
                </button>
              </li>
            ))}
        </ul>
      </section>
    );
  }

  // --- END --- ---------------------------------------------------
  const merlin = assigned.find((a) => a.role === "merlin")!;
  const assassin = assigned.find((a) => a.role === "assassin")!;
  return (
    <section className="mx-auto max-w-lg animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Game over</p>
      <h2 className={`mt-2 font-display text-5xl italic ${phase.winner === "good" ? "text-[hsl(210_80%_65%)]" : "text-[hsl(0_70%_55%)]"}`}>
        {phase.winner === "good" ? "Good wins." : "Evil wins."}
      </h2>
      <p className="mt-3 text-sm text-muted">{phase.reason}</p>
      <div className="mt-8 rounded-md border border-border bg-bg/60 p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">role reveal</div>
        <ul className="mt-3 divide-y divide-border/60 text-sm">
          {assigned.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span className="text-fg">{a.name}</span>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: ROLES[a.role].accent }}>
                {ROLES[a.role].name}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Merlin: <span className="text-[hsl(260_70%_70%)]">{merlin.name}</span> · Assassin: <span className="text-[hsl(0_70%_55%)]">{assassin.name}</span>
        </p>
      </div>
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => finishGame(phase.winner, phase.reason)}
          className="flex-1 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="flex-1 rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          Back to catalog
        </button>
      </div>
    </section>
  );
};

// --- Sub-components --- ------------------------------------------

function RevealCard({
  player,
  role,
  evilTeam,
  onPass,
}: {
  player: PlayerState;
  role: { name: string; description: string; accent: string; team: "good" | "evil"; id: RoleId };
  evilTeam: PlayerState[];
  onPass: () => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Pass the phone to</p>
      <h2 className="mt-2 font-display text-4xl italic">{player.name}</h2>
      {!shown ? (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="mt-10 w-full rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.08)] py-5 font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))] transition-colors hover:bg-[hsl(var(--ember)/0.16)]"
        >
          Reveal my role — only I should see
        </button>
      ) : (
        <div className="mt-10 rounded-md border px-6 py-8" style={{ borderColor: role.accent }}>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: role.accent }}>
            your role
          </div>
          <h3 className="mt-2 font-display text-5xl" style={{ color: role.accent }}>
            {role.name}
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-fg/90">{role.description}</p>
          {evilTeam.length > 0 && (
            <div className="mt-6 rounded-md border border-[hsl(0_70%_55%/0.4)] bg-[hsl(0_70%_55%/0.08)] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(0_70%_55%)]">
                {role.id === "merlin" ? "You see evil:" : "Your fellow conspirators:"}
              </p>
              <p className="mt-2 text-sm text-fg">
                {evilTeam.map((p) => p.name).join(", ")}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onPass}
            className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
          >
            Hide & pass phone →
          </button>
        </div>
      )}
    </section>
  );
}

function QuestPlayCard({
  player,
  canFail,
  onPlay,
}: {
  player: PlayerState;
  canFail: boolean;
  onPlay: (choice: "success" | "fail") => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Pass the phone to</p>
      <h2 className="mt-2 font-display text-4xl italic">{player.name}</h2>
      {!shown ? (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="mt-10 w-full rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.08)] py-5 font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))] transition-colors hover:bg-[hsl(var(--ember)/0.16)]"
        >
          Play my quest card — only I should see
        </button>
      ) : (
        <div className="mt-10">
          <p className="text-sm text-muted">Play secretly. Hide the screen before passing back.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onPlay("success")}
              className="rounded-md border border-[hsl(210_80%_65%/0.5)] bg-[hsl(210_80%_65%/0.1)] py-6 font-mono text-xs uppercase tracking-wider text-[hsl(210_80%_65%)] transition-opacity hover:opacity-90"
            >
              Success
            </button>
            <button
              type="button"
              disabled={!canFail}
              onClick={() => onPlay("fail")}
              className="rounded-md border border-[hsl(0_70%_55%/0.5)] bg-[hsl(0_70%_55%/0.1)] py-6 font-mono text-xs uppercase tracking-wider text-[hsl(0_70%_55%)] transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Fail
            </button>
          </div>
          {!canFail && (
            <p className="mt-3 text-xs text-muted">Loyal knights can only play success.</p>
          )}
        </div>
      )}
    </section>
  );
}

function LoadingCard() {
  return <section className="mx-auto max-w-md animate-fade-up text-center text-sm text-muted">Resolving…</section>;
}

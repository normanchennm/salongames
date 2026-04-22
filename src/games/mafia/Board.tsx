"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { playCue, MAFIA_CUES } from "@/lib/narrator";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { ROLES, defaultRoleMix, shuffle, type RoleId } from "./roles";
import { RoleArt } from "@/components/RoleArt";

/** Mafia pass-and-play MVP. Covers the full loop:
 *  lobby → secret role reveal → night phase → day discussion →
 *  vote → day resolution → loop until one team wins.
 *
 *  No video, no networking, no Supabase — pure React state. Phone is
 *  passed around the table for private role reveals. Shell's
 *  PlayerRoster is already set up before we get here, so our props
 *  are just the player list + onComplete / onQuit callbacks. */

type Phase =
  | { kind: "reveal"; current: number }           // passing phone for private reveals
  | { kind: "night-intro" }                        // "everyone close eyes" narration
  | { kind: "night-mafia"; selectedTargetId: string | null }
  | { kind: "night-detective"; selectedTargetId: string | null; learned: { id: string; team: string } | null }
  | { kind: "night-doctor"; selectedTargetId: string | null }
  | { kind: "day-resolution"; killedId: string | null }
  | { kind: "day-discussion" }
  | { kind: "day-vote"; votes: Record<string, string> }  // voterId -> targetId
  | { kind: "day-resolution-vote"; eliminatedId: string | null }
  | { kind: "end"; winningTeam: "town" | "mafia" };

interface PlayerState {
  id: string;
  name: string;
  role: RoleId;
  alive: boolean;
  /** Set true the first time the doctor self-protects. */
  doctorSelfProtectUsed?: boolean;
}

export const MafiaBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [state, setState] = useState(() => initialState(players));
  const alive = state.players.filter((p) => p.alive);
  useScrollToTop(state.phase.kind + (state.phase.kind === "reveal" ? String(state.phase.current) : ""));

  // Narration cues fire when the phase changes. Mirrors Werewolf's
  // wiring — missing MP3 = silent no-op.
  useEffect(() => {
    const kind = state.phase.kind;
    if (kind === "night-intro") playCue(MAFIA_CUES.nightIntro);
    else if (kind === "night-mafia") playCue(MAFIA_CUES.nightMafia);
    else if (kind === "night-detective") playCue(MAFIA_CUES.nightDetective);
    else if (kind === "night-doctor") playCue(MAFIA_CUES.nightDoctor);
    else if (kind === "day-resolution") {
      const p = state.phase as { kind: "day-resolution"; killedId: string | null };
      playCue(p.killedId ? MAFIA_CUES.dayKilled : MAFIA_CUES.daySafe);
    } else if (kind === "day-discussion") playCue(MAFIA_CUES.dayDiscuss);
    else if (kind === "day-vote") playCue(MAFIA_CUES.dayVote);
    else if (kind === "day-resolution-vote") {
      const p = state.phase as { kind: "day-resolution-vote"; eliminatedId: string | null };
      playCue(p.eliminatedId ? MAFIA_CUES.dayVotedOut : MAFIA_CUES.dayTie);
    } else if (kind === "end") {
      const p = state.phase as { kind: "end"; winningTeam: "town" | "mafia" };
      playCue(p.winningTeam === "town" ? MAFIA_CUES.townWins : MAFIA_CUES.mafiaWins);
    }
  }, [state.phase.kind]);

  // --- win-check helper --- --------------------------------------
  function checkWin(players: PlayerState[]): "town" | "mafia" | null {
    const alive = players.filter((p) => p.alive);
    const wolves = alive.filter((p) => p.role === "mafia").length;
    const others = alive.length - wolves;
    if (wolves === 0) return "town";
    if (wolves >= others) return "mafia";
    return null;
  }

  // --- completion wrapper --- ------------------------------------
  function finishGame(winningTeam: "town" | "mafia") {
    const winnerIds = state.players
      .filter((p) => (winningTeam === "town" ? p.role !== "mafia" : p.role === "mafia"))
      .map((p) => p.id);
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [
        `${winningTeam === "town" ? "Townsfolk" : "Werewolves"} won`,
        `${state.players.filter((p) => !p.alive).length} eliminated in ${state.round} round${state.round === 1 ? "" : "s"}`,
      ],
    });
  }

  // --- phase-specific UIs --- ------------------------------------

  if (state.phase.kind === "reveal") {
    const current = state.players[state.phase.current];
    const role = ROLES[current.role];
    return (
      <RevealCard
        playerName={current.name}
        roleName={role.name}
        roleId={current.role}
        roleDescription={role.description}
        roleAccent={role.accent}
        onPass={() => {
          const next = state.phase.kind === "reveal" ? state.phase.current + 1 : 0;
          if (next >= state.players.length) {
            setState({ ...state, phase: { kind: "night-intro" } });
          } else {
            setState({ ...state, phase: { kind: "reveal", current: next } });
          }
        }}
      />
    );
  }

  if (state.phase.kind === "night-intro") {
    return (
      <NarrationCard
        title="Night falls."
        subtitle="Everyone closes their eyes. When I call your role, open yours — answer on the phone when it reaches you."
        onAdvance={() => setState({ ...state, phase: { kind: "night-mafia", selectedTargetId: null } })}
      />
    );
  }

  if (state.phase.kind === "night-mafia") {
    const werewolves = state.players.filter((p) => p.alive && p.role === "mafia");
    const targets = state.players.filter((p) => p.alive && p.role !== "mafia");
    return (
      <NightActionCard
        roleName="Werewolves"
        prompt={`${werewolves.map((p) => p.name).join(" and ")}, open your eyes. Choose one townsperson to eliminate.`}
        targets={targets}
        selectedId={state.phase.selectedTargetId}
        onSelect={(id) =>
          setState({ ...state, phase: { kind: "night-mafia", selectedTargetId: id } })
        }
        onConfirm={() => {
          const attackId = state.phase.kind === "night-mafia" ? state.phase.selectedTargetId : null;
          const hasDetective = state.players.some((p) => p.alive && p.role === "detective");
          if (hasDetective) {
            setState({
              ...state,
              nightAttackId: attackId,
              phase: { kind: "night-detective", selectedTargetId: null, learned: null },
            });
          } else {
            moveToDoctorOrResolve(attackId);
          }
        }}
      />
    );

    function moveToDoctorOrResolve(attackId: string | null) {
      const hasDoctor = state.players.some((p) => p.alive && p.role === "doctor");
      if (hasDoctor) {
        setState((prev) => ({
          ...prev,
          nightAttackId: attackId,
          phase: { kind: "night-doctor", selectedTargetId: null },
        }));
      } else {
        resolveNight(attackId, null);
      }
    }
  }

  if (state.phase.kind === "night-detective") {
    const phase = state.phase;  // narrowed local so JSX closures keep the type
    const seer = state.players.find((p) => p.alive && p.role === "detective");
    const targets = state.players.filter((p) => p.alive && p.id !== seer?.id);
    const learnedName = phase.learned
      ? state.players.find((p) => p.id === phase.learned!.id)?.name
      : null;
    return (
      <NightActionCard
        roleName="Detective"
        prompt={`${seer?.name}, open your eyes. Choose one player to learn their team.`}
        targets={targets}
        selectedId={phase.selectedTargetId}
        onSelect={(id) => {
          const target = state.players.find((p) => p.id === id);
          const team = target ? ROLES[target.role].team : "town";
          setState({
            ...state,
            phase: { kind: "night-detective", selectedTargetId: id, learned: target ? { id: target.id, team } : null },
          });
        }}
        onConfirm={() => {
          const attackId = state.nightAttackId ?? null;
          const hasDoctor = state.players.some((p) => p.alive && p.role === "doctor");
          if (hasDoctor) {
            setState({ ...state, phase: { kind: "night-doctor", selectedTargetId: null } });
          } else {
            resolveNight(attackId, null);
          }
        }}
        extraFooter={
          phase.learned && (
            <div className="mt-4 rounded-md border border-border bg-bg/60 px-4 py-3 text-center text-sm text-fg">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">result</span>
              <div className="mt-1 font-display italic">
                {learnedName}{" "}
                is on the <span className="font-semibold text-[hsl(var(--ember))]">{phase.learned.team}</span> team.
              </div>
            </div>
          )
        }
      />
    );
  }

  if (state.phase.kind === "night-doctor") {
    const doctor = state.players.find((p) => p.alive && p.role === "doctor");
    return (
      <NightActionCard
        roleName="Doctor"
        prompt={`${doctor?.name}, open your eyes. Choose one player to protect tonight.`}
        targets={state.players.filter((p) => p.alive)}
        selectedId={state.phase.selectedTargetId}
        onSelect={(id) =>
          setState({ ...state, phase: { kind: "night-doctor", selectedTargetId: id } })
        }
        onConfirm={() => {
          const protectId = state.phase.kind === "night-doctor" ? state.phase.selectedTargetId : null;
          resolveNight(state.nightAttackId ?? null, protectId);
        }}
      />
    );
  }

  if (state.phase.kind === "day-resolution") {
    const phase = state.phase;
    const killed = state.players.find((p) => p.id === phase.killedId);
    return (
      <NarrationCard
        title={killed ? `${killed.name} was killed in the night.` : "Nobody died in the night."}
        subtitle={killed ? `They were a ${ROLES[killed.role].name}.` : "The doctor's watch held."}
        onAdvance={() => {
          const winner = checkWin(state.players);
          if (winner) {
            setState({ ...state, phase: { kind: "end", winningTeam: winner } });
          } else {
            setState({ ...state, phase: { kind: "day-discussion" } });
          }
        }}
      />
    );
  }

  if (state.phase.kind === "day-discussion") {
    return (
      <NarrationCard
        title="Day breaks. Discuss."
        subtitle="Share what you know (or what you want others to think you know). When the table's ready, call the vote."
        ctaLabel="Call the vote"
        onAdvance={() => setState({ ...state, phase: { kind: "day-vote", votes: {} } })}
      />
    );
  }

  if (state.phase.kind === "day-vote") {
    const nextVoter = alive.find((p) => !(state.phase.kind === "day-vote" && state.phase.votes[p.id]));
    if (!nextVoter) {
      // tally
      const tally: Record<string, number> = {};
      if (state.phase.kind === "day-vote") {
        for (const targetId of Object.values(state.phase.votes)) {
          tally[targetId] = (tally[targetId] || 0) + 1;
        }
      }
      const max = Math.max(...Object.values(tally), 0);
      const leaders = Object.entries(tally).filter(([, n]) => n === max);
      // tie → nobody eliminated
      const eliminatedId = leaders.length === 1 ? leaders[0][0] : null;
      const updatedPlayers = state.players.map((p) =>
        p.id === eliminatedId ? { ...p, alive: false } : p,
      );
      const winner = checkWin(updatedPlayers);
      setTimeout(() => {
        setState({
          ...state,
          players: updatedPlayers,
          phase: winner
            ? { kind: "end", winningTeam: winner }
            : { kind: "day-resolution-vote", eliminatedId },
        });
      }, 0);
      return <LoadingCard />;
    }
    return (
      <NightActionCard
        roleName={`${nextVoter.name} — cast your vote`}
        prompt="Pass the phone. Tap the player you want to eliminate. The vote is secret to the phone-holder."
        targets={alive.filter((p) => p.id !== nextVoter.id)}
        selectedId={null}
        onSelect={(id) =>
          setState((prev) => {
            if (prev.phase.kind !== "day-vote") return prev;
            return {
              ...prev,
              phase: { kind: "day-vote", votes: { ...prev.phase.votes, [nextVoter.id]: id } },
            };
          })
        }
        onConfirm={() => {}}
        confirmHidden
      />
    );
  }

  if (state.phase.kind === "day-resolution-vote") {
    const phase = state.phase;
    const eliminated = state.players.find((p) => p.id === phase.eliminatedId);
    return (
      <NarrationCard
        title={eliminated ? `${eliminated.name} was voted out.` : "Tie vote. Nobody is eliminated."}
        subtitle={eliminated ? `They were a ${ROLES[eliminated.role].name}.` : "Discussion resumes."}
        onAdvance={() => {
          const winner = checkWin(state.players);
          if (winner) {
            setState({ ...state, phase: { kind: "end", winningTeam: winner } });
          } else {
            // next round
            setState({
              ...state,
              round: state.round + 1,
              nightAttackId: null,
              phase: { kind: "night-intro" },
            });
          }
        }}
      />
    );
  }

  // --- end --- ----------------------------------------------------
  if (state.phase.kind === "end") {
    const team = state.phase.winningTeam;
    return (
      <EndScreen
        winningTeam={team}
        players={state.players}
        onFinish={() => finishGame(team)}
        onQuit={onQuit}
      />
    );
  }

  return <LoadingCard />;

  // --- helpers that close over state setters --- ------------------

  function resolveNight(attackId: string | null, protectId: string | null) {
    const killedId = attackId && attackId !== protectId ? attackId : null;
    setState((prev) => {
      const players = prev.players.map((p) =>
        p.id === killedId ? { ...p, alive: false } : p,
      );
      return {
        ...prev,
        players,
        nightAttackId: null,
        phase: { kind: "day-resolution", killedId },
      };
    });
  }
};

// --- Sub-components --- ------------------------------------------

function initialState(players: { id: string; name: string; color: string }[]): {
  players: PlayerState[];
  round: number;
  phase: Phase;
  nightAttackId: string | null;
} {
  const mix = defaultRoleMix(players.length);
  const roles = shuffle(mix);
  const withRoles: PlayerState[] = players.map((p, i) => ({
    id: p.id,
    name: p.name,
    role: roles[i],
    alive: true,
  }));
  return {
    players: withRoles,
    round: 1,
    phase: { kind: "reveal", current: 0 },
    nightAttackId: null,
  };
}

interface RevealCardProps {
  playerName: string;
  roleName: string;
  roleId: RoleId;
  roleDescription: string;
  roleAccent: string;
  onPass: () => void;
}
function RevealCard({ playerName, roleName, roleId, roleDescription, roleAccent, onPass }: RevealCardProps) {
  const [shown, setShown] = useState(false);
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Pass the phone to</p>
      <h2 className="mt-2 font-display text-4xl italic">{playerName}</h2>
      {!shown ? (
        <button
          type="button"
          onClick={() => {
            setShown(true);
            // No narration on role reveal — would leak the role to
            // anyone near the phone. Role shows visually only.
            void roleId;
          }}
          className="mt-10 w-full rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.08)] py-5 font-mono text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--ember))] transition-colors hover:bg-[hsl(var(--ember)/0.16)]"
        >
          Reveal my role — only I should see
        </button>
      ) : (
        <div className="mt-10 rounded-md border px-6 py-8" style={{ borderColor: roleAccent }}>
          <RoleArt game="mafia" role={roleId} fallback={["#1a1008", "#100d0b"]} className="aspect-[4/3] w-full mb-4" />
          <div className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: roleAccent }}>
            your role
          </div>
          <h3 className="mt-2 font-display text-5xl" style={{ color: roleAccent }}>
            {roleName}
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-fg/90">{roleDescription}</p>
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

interface NarrationCardProps {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onAdvance: () => void;
}
function NarrationCard({ title, subtitle, ctaLabel = "Continue →", onAdvance }: NarrationCardProps) {
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      <h2 className="font-display text-5xl italic leading-tight text-fg">{title}</h2>
      {subtitle && <p className="mt-4 text-sm leading-relaxed text-muted">{subtitle}</p>}
      <button
        type="button"
        onClick={onAdvance}
        className="mt-10 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
      >
        {ctaLabel}
      </button>
    </section>
  );
}

interface NightActionCardProps {
  roleName: string;
  prompt: string;
  targets: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  confirmHidden?: boolean;
  extraFooter?: React.ReactNode;
}
function NightActionCard({ roleName, prompt, targets, selectedId, onSelect, onConfirm, confirmHidden, extraFooter }: NightActionCardProps) {
  return (
    <section className="mx-auto max-w-md animate-fade-up">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">{roleName}</p>
      <h2 className="mt-2 font-display text-3xl italic text-fg">{prompt}</h2>
      <ul className="mt-8 space-y-2">
        {targets.map((t) => {
          const active = t.id === selectedId;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                className={
                  "w-full rounded-md border px-4 py-3 text-left font-mono text-sm uppercase tracking-wider transition-colors " +
                  (active
                    ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
                    : "border-border text-fg hover:border-[hsl(var(--ember)/0.5)]")
                }
              >
                {t.name}
              </button>
            </li>
          );
        })}
      </ul>
      {extraFooter}
      {!confirmHidden && (
        <button
          type="button"
          disabled={!selectedId}
          onClick={onConfirm}
          className="mt-8 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirm →
        </button>
      )}
    </section>
  );
}

function LoadingCard() {
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center text-sm text-muted">
      Resolving…
    </section>
  );
}

interface EndScreenProps {
  winningTeam: "town" | "mafia";
  players: PlayerState[];
  onFinish: () => void;
  onQuit: () => void;
}
function EndScreen({ winningTeam, players, onFinish, onQuit }: EndScreenProps) {
  return (
    <section className="mx-auto max-w-lg animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Game over</p>
      <h2 className="mt-2 font-display text-5xl italic text-[hsl(var(--ember))]">
        {winningTeam === "town" ? "The town wins." : "The werewolves win."}
      </h2>
      <div className="mt-10 rounded-lg border border-border bg-bg/60 p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">role reveal</div>
        <ul className="mt-3 divide-y divide-border/60">
          {players.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span className={p.alive ? "text-fg" : "text-muted line-through"}>{p.name}</span>
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: ROLES[p.role].accent }}>
                {ROLES[p.role].name}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={onFinish}
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
}

/** Avalon remote state machine.
 *
 *  Same mission/vote loop as Resistance but with named roles (Merlin,
 *  Assassin, Minions, Loyal Knights) and an Assassin phase at the end:
 *  if Good wins 3 quests, the Assassin names a player as Merlin.
 *  Correct guess flips the win to Evil. */

import { ROLES, buildRoleMix, failsNeeded, TEAM_SIZES, type RoleId, type Team } from "./roles";

export { TEAM_SIZES, failsNeeded, type RoleId, type Team };

export interface MissionRecord {
  success: boolean;
  failCount: number;
}

export type AvalonRemoteState =
  | {
      kind: "reveal";
      playerOrder: string[];
      roles: Record<string, RoleId>;
      confirmed: Record<string, boolean>;
    }
  | {
      kind: "team-select";
      playerOrder: string[];
      roles: Record<string, RoleId>;
      mission: number;
      leaderIdx: number;
      rejectStreak: number;
      missions: MissionRecord[];
      teamIds: string[];
    }
  | {
      kind: "voting";
      playerOrder: string[];
      roles: Record<string, RoleId>;
      mission: number;
      leaderIdx: number;
      rejectStreak: number;
      missions: MissionRecord[];
      teamIds: string[];
      votes: Record<string, "up" | "down">;
    }
  | {
      kind: "vote-result";
      playerOrder: string[];
      roles: Record<string, RoleId>;
      mission: number;
      leaderIdx: number;
      rejectStreak: number;
      missions: MissionRecord[];
      teamIds: string[];
      votes: Record<string, "up" | "down">;
      approved: boolean;
    }
  | {
      kind: "mission-play";
      playerOrder: string[];
      roles: Record<string, RoleId>;
      mission: number;
      leaderIdx: number;
      rejectStreak: number;
      missions: MissionRecord[];
      teamIds: string[];
      plays: Record<string, "success" | "fail">;
    }
  | {
      kind: "mission-result";
      playerOrder: string[];
      roles: Record<string, RoleId>;
      mission: number;
      leaderIdx: number;
      rejectStreak: number;
      missions: MissionRecord[];
      teamIds: string[];
      success: boolean;
      failCount: number;
    }
  | {
      kind: "assassin-guess";
      playerOrder: string[];
      roles: Record<string, RoleId>;
      missions: MissionRecord[];
    }
  | {
      kind: "end";
      playerOrder: string[];
      roles: Record<string, RoleId>;
      missions: MissionRecord[];
      winner: Team;
      assassinGuess?: { targetId: string; correct: boolean };
    };

export type AvalonRemoteAction =
  | { type: "confirm-role" }
  | { type: "propose-team"; teamIds: string[] }
  | { type: "vote"; choice: "up" | "down" }
  | { type: "play"; choice: "success" | "fail" }
  | { type: "continue" }
  | { type: "assassin-pick"; targetId: string }
  | { type: "play-again" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function avalonRemoteInitialState(
  players: Array<{ peerId: string; name: string }>,
): AvalonRemoteState {
  const shuffled = shuffle(players);
  const playerOrder = shuffled.map((p) => p.peerId);
  const mix = shuffle(buildRoleMix(playerOrder.length));
  const roles: Record<string, RoleId> = {};
  playerOrder.forEach((id, i) => (roles[id] = mix[i] ?? "loyal"));
  return {
    kind: "reveal",
    playerOrder,
    roles,
    confirmed: {},
  };
}

function hostOf(players: MinimalPlayer[]): string | undefined {
  return players.find((p) => p.isHost)?.peerId;
}

export function avalonRemoteReducer(
  state: AvalonRemoteState,
  action: AvalonRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): AvalonRemoteState {
  const hostId = hostOf(livePlayers);

  if (action.type === "confirm-role") {
    if (state.kind !== "reveal") return state;
    if (!state.playerOrder.includes(senderPeerId)) return state;
    const nextConfirmed = { ...state.confirmed, [senderPeerId]: true };
    const allConfirmed = state.playerOrder.every((id) => nextConfirmed[id]);
    if (!allConfirmed) return { ...state, confirmed: nextConfirmed };
    return {
      kind: "team-select",
      playerOrder: state.playerOrder,
      roles: state.roles,
      mission: 0,
      leaderIdx: 0,
      rejectStreak: 0,
      missions: [],
      teamIds: [],
    };
  }

  if (action.type === "propose-team") {
    if (state.kind !== "team-select") return state;
    const leaderId = state.playerOrder[state.leaderIdx];
    if (senderPeerId !== leaderId) return state;
    const needed = TEAM_SIZES[state.playerOrder.length]?.[state.mission];
    if (!needed) return state;
    if (action.teamIds.length !== needed) return state;
    if (action.teamIds.some((id) => !state.playerOrder.includes(id))) return state;
    if (new Set(action.teamIds).size !== action.teamIds.length) return state;
    return {
      kind: "voting",
      playerOrder: state.playerOrder,
      roles: state.roles,
      mission: state.mission,
      leaderIdx: state.leaderIdx,
      rejectStreak: state.rejectStreak,
      missions: state.missions,
      teamIds: action.teamIds,
      votes: {},
    };
  }

  if (action.type === "vote") {
    if (state.kind !== "voting") return state;
    if (!state.playerOrder.includes(senderPeerId)) return state;
    if (state.votes[senderPeerId]) return state;
    const nextVotes = { ...state.votes, [senderPeerId]: action.choice };
    const allVoted = state.playerOrder.every((id) => nextVotes[id]);
    if (!allVoted) return { ...state, votes: nextVotes };
    const ups = Object.values(nextVotes).filter((v) => v === "up").length;
    const approved = ups > state.playerOrder.length - ups;
    return {
      kind: "vote-result",
      playerOrder: state.playerOrder,
      roles: state.roles,
      mission: state.mission,
      leaderIdx: state.leaderIdx,
      rejectStreak: state.rejectStreak,
      missions: state.missions,
      teamIds: state.teamIds,
      votes: nextVotes,
      approved,
    };
  }

  if (action.type === "play") {
    if (state.kind !== "mission-play") return state;
    if (!state.teamIds.includes(senderPeerId)) return state;
    if (state.plays[senderPeerId]) return state;
    // Good roles can only play success.
    const myRole = state.roles[senderPeerId];
    const myTeam = ROLES[myRole].team;
    if (myTeam === "good" && action.choice === "fail") return state;
    const nextPlays = { ...state.plays, [senderPeerId]: action.choice };
    const allIn = state.teamIds.every((id) => nextPlays[id]);
    if (!allIn) return { ...state, plays: nextPlays };
    const failCount = Object.values(nextPlays).filter((v) => v === "fail").length;
    const needed = failsNeeded(state.playerOrder.length, state.mission + 1);
    const success = failCount < needed;
    return {
      kind: "mission-result",
      playerOrder: state.playerOrder,
      roles: state.roles,
      mission: state.mission,
      leaderIdx: state.leaderIdx,
      rejectStreak: state.rejectStreak,
      missions: state.missions,
      teamIds: state.teamIds,
      success,
      failCount,
    };
  }

  if (action.type === "continue") {
    if (senderPeerId !== hostId) return state;

    if (state.kind === "vote-result") {
      if (state.approved) {
        return {
          kind: "mission-play",
          playerOrder: state.playerOrder,
          roles: state.roles,
          mission: state.mission,
          leaderIdx: state.leaderIdx,
          rejectStreak: 0,
          missions: state.missions,
          teamIds: state.teamIds,
          plays: {},
        };
      }
      const nextStreak = state.rejectStreak + 1;
      if (nextStreak >= 5) {
        return {
          kind: "end",
          playerOrder: state.playerOrder,
          roles: state.roles,
          missions: state.missions,
          winner: "evil",
        };
      }
      return {
        kind: "team-select",
        playerOrder: state.playerOrder,
        roles: state.roles,
        mission: state.mission,
        leaderIdx: (state.leaderIdx + 1) % state.playerOrder.length,
        rejectStreak: nextStreak,
        missions: state.missions,
        teamIds: [],
      };
    }

    if (state.kind === "mission-result") {
      const nextMissions: MissionRecord[] = [
        ...state.missions,
        { success: state.success, failCount: state.failCount },
      ];
      const successes = nextMissions.filter((m) => m.success).length;
      const failures = nextMissions.length - successes;
      if (failures >= 3) {
        return {
          kind: "end",
          playerOrder: state.playerOrder,
          roles: state.roles,
          missions: nextMissions,
          winner: "evil",
        };
      }
      if (successes >= 3) {
        // Assassin gets one shot at Merlin.
        return {
          kind: "assassin-guess",
          playerOrder: state.playerOrder,
          roles: state.roles,
          missions: nextMissions,
        };
      }
      return {
        kind: "team-select",
        playerOrder: state.playerOrder,
        roles: state.roles,
        mission: state.mission + 1,
        leaderIdx: (state.leaderIdx + 1) % state.playerOrder.length,
        rejectStreak: 0,
        missions: nextMissions,
        teamIds: [],
      };
    }
  }

  if (action.type === "assassin-pick") {
    if (state.kind !== "assassin-guess") return state;
    // Only the Assassin can submit.
    if (state.roles[senderPeerId] !== "assassin") return state;
    const target = state.roles[action.targetId];
    if (!target) return state;
    const correct = target === "merlin";
    return {
      kind: "end",
      playerOrder: state.playerOrder,
      roles: state.roles,
      missions: state.missions,
      winner: correct ? "evil" : "good",
      assassinGuess: { targetId: action.targetId, correct },
    };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return avalonRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

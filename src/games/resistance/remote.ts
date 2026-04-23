/** Resistance remote state machine.
 *
 *  Each player sees their role privately on their own device. Leader
 *  proposes a team on their device; everyone votes simultaneously on
 *  their device; if approved, team members privately play SUCCESS or
 *  FAIL (spies can fail; resistance must pick success). */

const SPY_COUNT: Record<number, number> = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
export const TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

export function missionNeeds2Fails(players: number, mission: number): boolean {
  return players >= 7 && mission === 3;
}

export type ResistanceRole = "resistance" | "spy";

export interface MissionRecord {
  success: boolean;
  failCount: number;
}

export type ResistanceRemoteState =
  | {
      kind: "reveal";
      playerOrder: string[];
      roles: Record<string, ResistanceRole>;
      confirmed: Record<string, boolean>;
    }
  | {
      kind: "team-select";
      playerOrder: string[];
      roles: Record<string, ResistanceRole>;
      mission: number;
      leaderIdx: number;
      rejectStreak: number;
      missions: MissionRecord[];
      teamIds: string[];
    }
  | {
      kind: "voting";
      playerOrder: string[];
      roles: Record<string, ResistanceRole>;
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
      roles: Record<string, ResistanceRole>;
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
      roles: Record<string, ResistanceRole>;
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
      roles: Record<string, ResistanceRole>;
      mission: number;
      leaderIdx: number;
      rejectStreak: number;
      missions: MissionRecord[];
      teamIds: string[];
      success: boolean;
      failCount: number;
    }
  | {
      kind: "end";
      playerOrder: string[];
      roles: Record<string, ResistanceRole>;
      missions: MissionRecord[];
      winner: "resistance" | "spies";
    };

export type ResistanceRemoteAction =
  | { type: "confirm-role" }
  | { type: "propose-team"; teamIds: string[] } // leader
  | { type: "vote"; choice: "up" | "down" }
  | { type: "play"; choice: "success" | "fail" }
  | { type: "continue" } // host advances out of vote-result / mission-result
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

export function resistanceRemoteInitialState(
  players: Array<{ peerId: string; name: string }>,
): ResistanceRemoteState {
  const shuffled = shuffle(players);
  const playerOrder = shuffled.map((p) => p.peerId);
  const spyN = SPY_COUNT[playerOrder.length] ?? 2;
  const roles: Record<string, ResistanceRole> = {};
  shuffled.forEach((p, i) => (roles[p.peerId] = i < spyN ? "spy" : "resistance"));
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

export function resistanceRemoteReducer(
  state: ResistanceRemoteState,
  action: ResistanceRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): ResistanceRemoteState {
  const hostId = hostOf(livePlayers);

  if (action.type === "confirm-role") {
    if (state.kind !== "reveal") return state;
    if (!state.playerOrder.includes(senderPeerId)) return state;
    const nextConfirmed = { ...state.confirmed, [senderPeerId]: true };
    const allConfirmed = state.playerOrder.every((id) => nextConfirmed[id]);
    if (!allConfirmed) return { ...state, confirmed: nextConfirmed };
    // Advance to first team selection.
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
    // Resistance can't pick fail.
    const myRole = state.roles[senderPeerId];
    if (myRole === "resistance" && action.choice === "fail") return state;
    const nextPlays = { ...state.plays, [senderPeerId]: action.choice };
    const allIn = state.teamIds.every((id) => nextPlays[id]);
    if (!allIn) return { ...state, plays: nextPlays };
    const failCount = Object.values(nextPlays).filter((v) => v === "fail").length;
    const needsTwo = missionNeeds2Fails(state.playerOrder.length, state.mission);
    const success = needsTwo ? failCount < 2 : failCount === 0;
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
      // Rejection: streak increments. 5 rejections = spies win.
      const nextStreak = state.rejectStreak + 1;
      if (nextStreak >= 5) {
        return {
          kind: "end",
          playerOrder: state.playerOrder,
          roles: state.roles,
          missions: state.missions,
          winner: "spies",
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
      if (successes >= 3) {
        return {
          kind: "end",
          playerOrder: state.playerOrder,
          roles: state.roles,
          missions: nextMissions,
          winner: "resistance",
        };
      }
      if (failures >= 3) {
        return {
          kind: "end",
          playerOrder: state.playerOrder,
          roles: state.roles,
          missions: nextMissions,
          winner: "spies",
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

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return resistanceRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

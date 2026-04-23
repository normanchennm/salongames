/** Mafia remote state machine.
 *
 *  Mechanically identical to Werewolf (this is the deliberate reskin
 *  take). Each player sees their role privately, night actions run in
 *  parallel, day vote is simultaneous. Keeping the remote state in
 *  this file rather than parameterizing Werewolf's lets each game
 *  register under its own id in the remote-registry without extra
 *  plumbing — and keeps the types crisp (role ids are disjoint). */

import { ROLES, defaultRoleMix, type RoleId, type Team } from "./roles";

export interface MafiaPlayer {
  peerId: string;
  name: string;
  role: RoleId;
  alive: boolean;
  doctorSelfProtectUsed?: boolean;
}

export type MafiaRemoteState =
  | {
      kind: "reveal";
      round: 0;
      players: MafiaPlayer[];
      confirmed: Record<string, boolean>;
    }
  | {
      kind: "night";
      round: number;
      players: MafiaPlayer[];
      mafiaVotes: Record<string, string | null>;
      detectiveSubmissions: Record<string, string | null>;
      doctorSubmissions: Record<string, string | null>;
    }
  | {
      kind: "day-resolve";
      round: number;
      players: MafiaPlayer[];
      killedId: string | null;
      detectiveReads: Array<{ detectiveId: string; targetId: string; team: Team }>;
    }
  | {
      kind: "day-vote";
      round: number;
      players: MafiaPlayer[];
      votes: Record<string, string>;
    }
  | {
      kind: "day-voted-out";
      round: number;
      players: MafiaPlayer[];
      eliminatedId: string | null;
    }
  | { kind: "end"; winningTeam: Team; players: MafiaPlayer[] };

export type MafiaRemoteAction =
  | { type: "confirm-role" }
  | { type: "mafia-vote"; targetId: string | null }
  | { type: "detective-check"; targetId: string | null }
  | { type: "doctor-protect"; targetId: string | null }
  | { type: "start-night" }
  | { type: "start-day-vote" }
  | { type: "day-vote"; targetId: string }
  | { type: "continue" }
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

export function mafiaRemoteInitialState(
  players: Array<{ peerId: string; name: string }>,
): MafiaRemoteState {
  const mix = shuffle(defaultRoleMix(players.length));
  const shuffled = shuffle(players);
  const mPlayers: MafiaPlayer[] = shuffled.map((p, i) => ({
    peerId: p.peerId,
    name: p.name,
    role: mix[i] ?? "townsperson",
    alive: true,
  }));
  return { kind: "reveal", round: 0, players: mPlayers, confirmed: {} };
}

function aliveOf(players: MafiaPlayer[], predicate: (p: MafiaPlayer) => boolean = () => true) {
  return players.filter((p) => p.alive && predicate(p));
}

function checkWin(players: MafiaPlayer[]): Team | null {
  const alive = aliveOf(players);
  const mob = alive.filter((p) => p.role === "mafia").length;
  const others = alive.length - mob;
  if (mob === 0) return "town";
  if (mob >= others) return "mafia";
  return null;
}

function resolveMobTarget(votes: Record<string, string | null>): string | null {
  const counts = new Map<string, number>();
  for (const t of Object.values(votes)) {
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const max = Math.max(...counts.values());
  const top = Array.from(counts.entries()).filter(([, c]) => c === max).map(([t]) => t);
  return top[Math.floor(Math.random() * top.length)];
}

function maybeResolveNight(state: Extract<MafiaRemoteState, { kind: "night" }>): MafiaRemoteState {
  const aliveMob = aliveOf(state.players, (p) => p.role === "mafia");
  const aliveDetectives = aliveOf(state.players, (p) => p.role === "detective");
  const aliveDoctors = aliveOf(state.players, (p) => p.role === "doctor");

  const allMob = aliveMob.every((w) => state.mafiaVotes[w.peerId] !== undefined);
  const allDet = aliveDetectives.every((s) => state.detectiveSubmissions[s.peerId] !== undefined);
  const allDoc = aliveDoctors.every((d) => state.doctorSubmissions[d.peerId] !== undefined);
  if (!(allMob && allDet && allDoc)) return state;

  const mobTarget = resolveMobTarget(state.mafiaVotes);
  const protectedIds = new Set(
    Object.values(state.doctorSubmissions).filter((v): v is string => !!v),
  );
  const killedId = mobTarget && !protectedIds.has(mobTarget) ? mobTarget : null;

  const nextPlayers = state.players.map((p) => {
    if (p.role === "doctor" && state.doctorSubmissions[p.peerId] === p.peerId) {
      return { ...p, doctorSelfProtectUsed: true };
    }
    return p;
  });
  const afterKill = nextPlayers.map((p) =>
    killedId && p.peerId === killedId ? { ...p, alive: false } : p,
  );

  const detectiveReads: Array<{ detectiveId: string; targetId: string; team: Team }> = [];
  for (const [detId, targetId] of Object.entries(state.detectiveSubmissions)) {
    if (!targetId) continue;
    const target = nextPlayers.find((p) => p.peerId === targetId);
    if (target) detectiveReads.push({ detectiveId: detId, targetId, team: ROLES[target.role].team });
  }

  const win = checkWin(afterKill);
  if (win) return { kind: "end", winningTeam: win, players: afterKill };
  return {
    kind: "day-resolve",
    round: state.round,
    players: afterKill,
    killedId,
    detectiveReads,
  };
}

export function mafiaRemoteReducer(
  state: MafiaRemoteState,
  action: MafiaRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): MafiaRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;
  const sender = livePlayers.find((p) => p.peerId === senderPeerId);
  if (!sender) return state;

  if (action.type === "confirm-role") {
    if (state.kind !== "reveal") return state;
    if (!state.players.some((p) => p.peerId === senderPeerId)) return state;
    return { ...state, confirmed: { ...state.confirmed, [senderPeerId]: true } };
  }

  if (action.type === "start-night") {
    if (state.kind !== "reveal") return state;
    if (senderPeerId !== hostId) return state;
    return {
      kind: "night",
      round: 1,
      players: state.players,
      mafiaVotes: {},
      detectiveSubmissions: {},
      doctorSubmissions: {},
    };
  }

  if (action.type === "mafia-vote") {
    if (state.kind !== "night") return state;
    const me = state.players.find((p) => p.peerId === senderPeerId);
    if (!me || !me.alive || me.role !== "mafia") return state;
    if (action.targetId) {
      const target = state.players.find((p) => p.peerId === action.targetId);
      if (!target || !target.alive) return state;
    }
    const nextVotes = { ...state.mafiaVotes, [senderPeerId]: action.targetId };
    return maybeResolveNight({ ...state, mafiaVotes: nextVotes });
  }

  if (action.type === "detective-check") {
    if (state.kind !== "night") return state;
    const me = state.players.find((p) => p.peerId === senderPeerId);
    if (!me || !me.alive || me.role !== "detective") return state;
    if (action.targetId) {
      const target = state.players.find((p) => p.peerId === action.targetId);
      if (!target || !target.alive) return state;
    }
    const nextSubs = { ...state.detectiveSubmissions, [senderPeerId]: action.targetId };
    return maybeResolveNight({ ...state, detectiveSubmissions: nextSubs });
  }

  if (action.type === "doctor-protect") {
    if (state.kind !== "night") return state;
    const me = state.players.find((p) => p.peerId === senderPeerId);
    if (!me || !me.alive || me.role !== "doctor") return state;
    if (action.targetId) {
      const target = state.players.find((p) => p.peerId === action.targetId);
      if (!target || !target.alive) return state;
      if (action.targetId === senderPeerId && me.doctorSelfProtectUsed) return state;
    }
    const nextSubs = { ...state.doctorSubmissions, [senderPeerId]: action.targetId };
    return maybeResolveNight({ ...state, doctorSubmissions: nextSubs });
  }

  if (action.type === "start-day-vote") {
    if (state.kind !== "day-resolve") return state;
    if (senderPeerId !== hostId) return state;
    return { kind: "day-vote", round: state.round, players: state.players, votes: {} };
  }

  if (action.type === "day-vote") {
    if (state.kind !== "day-vote") return state;
    const sender = state.players.find((p) => p.peerId === senderPeerId);
    if (!sender || !sender.alive) return state;
    const target = state.players.find((p) => p.peerId === action.targetId);
    if (!target || !target.alive) return state;
    const nextVotes = { ...state.votes, [senderPeerId]: action.targetId };
    const alive = aliveOf(state.players);
    const allIn = alive.every((p) => nextVotes[p.peerId]);
    if (!allIn) return { ...state, votes: nextVotes };

    const counts = new Map<string, number>();
    for (const t of Object.values(nextVotes)) counts.set(t, (counts.get(t) ?? 0) + 1);
    const max = Math.max(...counts.values());
    const top = Array.from(counts.entries()).filter(([, c]) => c === max).map(([id]) => id);
    const eliminatedId = top.length === 1 ? top[0] : null;
    const afterElim = state.players.map((p) =>
      eliminatedId && p.peerId === eliminatedId ? { ...p, alive: false } : p,
    );
    const win = checkWin(afterElim);
    if (win) return { kind: "end", winningTeam: win, players: afterElim };
    return { kind: "day-voted-out", round: state.round, players: afterElim, eliminatedId };
  }

  if (action.type === "continue") {
    if (senderPeerId !== hostId) return state;
    if (state.kind !== "day-voted-out") return state;
    const win = checkWin(state.players);
    if (win) return { kind: "end", winningTeam: win, players: state.players };
    return {
      kind: "night",
      round: state.round + 1,
      players: state.players,
      mafiaVotes: {},
      detectiveSubmissions: {},
      doctorSubmissions: {},
    };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return mafiaRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

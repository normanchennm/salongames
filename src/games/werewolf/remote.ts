/** Werewolf remote state machine.
 *
 *  Each player sees their role privately on their own device. Night
 *  actions run in parallel: werewolves coordinate through a vote
 *  (majority wins, random tie-break), seers check one player, doctors
 *  protect one player. When all alive night-actors have submitted, the
 *  reducer resolves the night and transitions to day. Day voting is
 *  simultaneous; majority is eliminated.
 *
 *  Privacy note: roles are broadcast in state (same tradeoff as other
 *  games here — devtools can peek). UI only surfaces your own role. */

import { ROLES, defaultRoleMix, type RoleId, type Team } from "./roles";

export interface WWPlayer {
  peerId: string;
  name: string;
  role: RoleId;
  alive: boolean;
  doctorSelfProtectUsed?: boolean;
}

export type WWRemoteState =
  | {
      kind: "reveal";
      round: 0;
      players: WWPlayer[];
      confirmed: Record<string, boolean>; // peerId -> has viewed + confirmed
    }
  | {
      kind: "night";
      round: number;
      players: WWPlayer[];
      wolfVotes: Record<string, string | null>; // wolfPeerId -> target peerId (or null skip)
      seerSubmissions: Record<string, string | null>; // seerPeerId -> checked peerId
      doctorSubmissions: Record<string, string | null>; // doctorPeerId -> protected peerId
    }
  | {
      kind: "day-resolve";
      round: number;
      players: WWPlayer[];
      killedId: string | null;
      seerReads: Array<{ seerId: string; targetId: string; team: Team }>;
    }
  | {
      kind: "day-vote";
      round: number;
      players: WWPlayer[];
      votes: Record<string, string>; // voterId -> targetId
    }
  | {
      kind: "day-voted-out";
      round: number;
      players: WWPlayer[];
      eliminatedId: string | null;
    }
  | { kind: "end"; winningTeam: Team; players: WWPlayer[] };

export type WWRemoteAction =
  | { type: "confirm-role" }
  | { type: "wolf-vote"; targetId: string | null }
  | { type: "seer-check"; targetId: string | null }
  | { type: "doctor-protect"; targetId: string | null }
  | { type: "start-night" } // host-only: from reveal → night
  | { type: "start-day-vote" } // host-only: from day-resolve → day-vote
  | { type: "continue" } // host-only: from day-voted-out → next night OR end
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

export function wwRemoteInitialState(players: Array<{ peerId: string; name: string }>): WWRemoteState {
  const mix = shuffle(defaultRoleMix(players.length));
  const shuffled = shuffle(players);
  const wwPlayers: WWPlayer[] = shuffled.map((p, i) => ({
    peerId: p.peerId,
    name: p.name,
    role: mix[i] ?? "villager",
    alive: true,
  }));
  return {
    kind: "reveal",
    round: 0,
    players: wwPlayers,
    confirmed: {},
  };
}

function aliveOf(players: WWPlayer[], predicate: (p: WWPlayer) => boolean = () => true): WWPlayer[] {
  return players.filter((p) => p.alive && predicate(p));
}

function checkWin(players: WWPlayer[]): Team | null {
  const alive = aliveOf(players);
  const wolves = alive.filter((p) => p.role === "werewolf").length;
  const others = alive.length - wolves;
  if (wolves === 0) return "village";
  if (wolves >= others) return "werewolf";
  return null;
}

/** Pick majority target from wolf votes; ties broken randomly. null if no votes. */
function resolveWolfTarget(wolfVotes: Record<string, string | null>): string | null {
  const counts = new Map<string, number>();
  for (const t of Object.values(wolfVotes)) {
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const max = Math.max(...counts.values());
  const top = Array.from(counts.entries()).filter(([, c]) => c === max).map(([t]) => t);
  return top[Math.floor(Math.random() * top.length)];
}

export function wwRemoteReducer(
  state: WWRemoteState,
  action: WWRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): WWRemoteState {
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
      wolfVotes: {},
      seerSubmissions: {},
      doctorSubmissions: {},
    };
  }

  if (action.type === "wolf-vote") {
    if (state.kind !== "night") return state;
    const me = state.players.find((p) => p.peerId === senderPeerId);
    if (!me || !me.alive || me.role !== "werewolf") return state;
    if (action.targetId) {
      const target = state.players.find((p) => p.peerId === action.targetId);
      if (!target || !target.alive) return state;
    }
    const nextVotes = { ...state.wolfVotes, [senderPeerId]: action.targetId };
    return maybeResolveNight({ ...state, wolfVotes: nextVotes });
  }

  if (action.type === "seer-check") {
    if (state.kind !== "night") return state;
    const me = state.players.find((p) => p.peerId === senderPeerId);
    if (!me || !me.alive || me.role !== "seer") return state;
    if (action.targetId) {
      const target = state.players.find((p) => p.peerId === action.targetId);
      if (!target || !target.alive) return state;
    }
    const nextSubs = { ...state.seerSubmissions, [senderPeerId]: action.targetId };
    return maybeResolveNight({ ...state, seerSubmissions: nextSubs });
  }

  if (action.type === "doctor-protect") {
    if (state.kind !== "night") return state;
    const me = state.players.find((p) => p.peerId === senderPeerId);
    if (!me || !me.alive || me.role !== "doctor") return state;
    if (action.targetId) {
      const target = state.players.find((p) => p.peerId === action.targetId);
      if (!target || !target.alive) return state;
      // Self-protection used at most once per game.
      if (action.targetId === senderPeerId && me.doctorSelfProtectUsed) return state;
    }
    const nextSubs = { ...state.doctorSubmissions, [senderPeerId]: action.targetId };
    return maybeResolveNight({ ...state, doctorSubmissions: nextSubs });
  }

  if (action.type === "start-day-vote") {
    if (state.kind !== "day-resolve") return state;
    if (senderPeerId !== hostId) return state;
    return {
      kind: "day-vote",
      round: state.round,
      players: state.players,
      votes: {},
    };
  }

  // Day votes
  if (state.kind === "day-vote") {
    // Handle in-place: we overload "wolf-vote" etc. above, but day votes
    // come in as... actually we haven't defined a day-vote action type.
    // We'll use "wolf-vote" semantics but only during day-vote phase.
    // Cleaner: add a dedicated action.
  }

  if (action.type === "continue") {
    if (senderPeerId !== hostId) return state;
    if (state.kind === "day-voted-out") {
      const win = checkWin(state.players);
      if (win) return { kind: "end", winningTeam: win, players: state.players };
      return {
        kind: "night",
        round: state.round + 1,
        players: state.players,
        wolfVotes: {},
        seerSubmissions: {},
        doctorSubmissions: {},
      };
    }
    return state;
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return wwRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

/** If all alive night-actors have submitted, resolve the night. */
function maybeResolveNight(state: Extract<WWRemoteState, { kind: "night" }>): WWRemoteState {
  const aliveWolves = aliveOf(state.players, (p) => p.role === "werewolf");
  const aliveSeers = aliveOf(state.players, (p) => p.role === "seer");
  const aliveDoctors = aliveOf(state.players, (p) => p.role === "doctor");

  const allWolves = aliveWolves.every((w) => state.wolfVotes[w.peerId] !== undefined);
  const allSeers = aliveSeers.every((s) => state.seerSubmissions[s.peerId] !== undefined);
  const allDoctors = aliveDoctors.every((d) => state.doctorSubmissions[d.peerId] !== undefined);

  if (!(allWolves && allSeers && allDoctors)) return state;

  // Resolve
  const wolfTarget = resolveWolfTarget(state.wolfVotes);
  // Doctor protection: if any doctor protected the wolf target, the victim lives.
  const doctorProtectedIds = new Set(
    Object.values(state.doctorSubmissions).filter((v): v is string => !!v),
  );
  const killedId = wolfTarget && !doctorProtectedIds.has(wolfTarget) ? wolfTarget : null;

  // Mark doctor self-protection used if any self-protected this night.
  const nextPlayers = state.players.map((p) => {
    if (p.role === "doctor" && state.doctorSubmissions[p.peerId] === p.peerId) {
      return { ...p, doctorSelfProtectUsed: true };
    }
    return p;
  });

  // Apply kill
  const afterKill = nextPlayers.map((p) =>
    killedId && p.peerId === killedId ? { ...p, alive: false } : p,
  );

  // Collect seer reads for the seer's private display on the next screen.
  const seerReads: Array<{ seerId: string; targetId: string; team: Team }> = [];
  for (const [seerId, targetId] of Object.entries(state.seerSubmissions)) {
    if (!targetId) continue;
    const target = nextPlayers.find((p) => p.peerId === targetId);
    if (target) seerReads.push({ seerId, targetId, team: ROLES[target.role].team });
  }

  const win = checkWin(afterKill);
  if (win) {
    return { kind: "end", winningTeam: win, players: afterKill };
  }

  return {
    kind: "day-resolve",
    round: state.round,
    players: afterKill,
    killedId,
    seerReads,
  };
}

// Separate day-vote action — we extend the reducer after the fact to
// keep the type clean. We'll intercept before the main dispatch table.
export type WWExtendedAction = WWRemoteAction | { type: "day-vote"; targetId: string };

export function wwRemoteReducerExtended(
  state: WWRemoteState,
  action: WWExtendedAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): WWRemoteState {
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

    // Tally
    const counts = new Map<string, number>();
    for (const t of Object.values(nextVotes)) counts.set(t, (counts.get(t) ?? 0) + 1);
    const max = Math.max(...counts.values());
    const top = Array.from(counts.entries()).filter(([, c]) => c === max).map(([id]) => id);
    // Ties: no elimination.
    const eliminatedId = top.length === 1 ? top[0] : null;
    const afterElim = state.players.map((p) =>
      eliminatedId && p.peerId === eliminatedId ? { ...p, alive: false } : p,
    );
    const win = checkWin(afterElim);
    if (win) return { kind: "end", winningTeam: win, players: afterElim };
    return {
      kind: "day-voted-out",
      round: state.round,
      players: afterElim,
      eliminatedId,
    };
  }
  return wwRemoteReducer(state, action, senderPeerId, livePlayers);
}

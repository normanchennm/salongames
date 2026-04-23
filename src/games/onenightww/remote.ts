/** One Night Werewolf remote state machine.
 *
 *  Each player gets a starting role privately on their own device.
 *  Night actions run in strict starting-role order, but on parallel
 *  devices — only the active role sees the action prompt; everyone
 *  else sees "the night passes". When the active actor submits, state
 *  advances to the next night role.
 *
 *  Swaps affect currentRoles; startingRoles is retained for ordering
 *  and so an actor who got swapped still wakes up in their starting
 *  slot. Vote phase: every player picks someone; majority dies; win
 *  conditions use currentRoles. */

export type Role = "werewolf" | "seer" | "robber" | "troublemaker" | "villager";

export const ROLE_LABEL: Record<Role, string> = {
  werewolf: "Werewolf",
  seer: "Seer",
  robber: "Robber",
  troublemaker: "Troublemaker",
  villager: "Villager",
};

export const ROLE_BLURB: Record<Role, string> = {
  werewolf: "You want to survive the vote. Don't get caught.",
  seer: "At night, peek at one player's card OR two center cards.",
  robber: "At night, swap cards with any player. You become their role.",
  troublemaker: "At night, swap two OTHER players' cards. You don't see them.",
  villager: "No night power. Trust your instincts.",
};

/** Private per-player night action results, visible only to them. */
export interface PrivateLog {
  seerSawPlayer?: { targetId: string; role: Role };
  seerSawCenter?: Array<{ idx: number; role: Role }>;
  robberNewRole?: Role;
  robberStoleFrom?: string;
  wolfBuddies?: string[];
}

export type ONRemoteState =
  | {
      kind: "reveal";
      playerOrder: string[];
      startingRoles: Record<string, Role>;
      currentRoles: Record<string, Role>;
      centerCards: Role[];
      confirmed: Record<string, boolean>;
      logs: Record<string, PrivateLog>;
    }
  | {
      kind: "night";
      playerOrder: string[];
      startingRoles: Record<string, Role>;
      currentRoles: Record<string, Role>;
      centerCards: Role[];
      logs: Record<string, PrivateLog>;
      step: "werewolves" | "seer" | "robber" | "troublemaker";
      stepDone: Record<string, boolean>; // keyed by step name
    }
  | {
      kind: "day";
      playerOrder: string[];
      startingRoles: Record<string, Role>;
      currentRoles: Record<string, Role>;
      centerCards: Role[];
      logs: Record<string, PrivateLog>;
    }
  | {
      kind: "voting";
      playerOrder: string[];
      startingRoles: Record<string, Role>;
      currentRoles: Record<string, Role>;
      centerCards: Role[];
      logs: Record<string, PrivateLog>;
      votes: Record<string, string>;
    }
  | {
      kind: "end";
      playerOrder: string[];
      startingRoles: Record<string, Role>;
      currentRoles: Record<string, Role>;
      centerCards: Role[];
      logs: Record<string, PrivateLog>;
      votes: Record<string, string>;
      killedIds: string[];
      winner: "village" | "werewolves";
    };

export type ONRemoteAction =
  | { type: "confirm-role" }
  | { type: "seer-peek-player"; targetId: string }
  | { type: "seer-peek-center"; idxs: [number, number] }
  | { type: "seer-skip" }
  | { type: "robber-swap"; targetId: string }
  | { type: "robber-skip" }
  | { type: "troublemaker-swap"; aId: string; bId: string }
  | { type: "troublemaker-skip" }
  | { type: "start-day" } // host: from night end to day
  | { type: "start-vote" } // host: day → voting
  | { type: "vote"; targetId: string }
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

function rolesFor(n: number): Role[] {
  const total = n + 3;
  const wwCount = n <= 4 ? 1 : 2;
  const pool: Role[] = [];
  for (let i = 0; i < wwCount; i++) pool.push("werewolf");
  pool.push("seer", "robber", "troublemaker");
  while (pool.length < total) pool.push("villager");
  return shuffle(pool);
}

export function onRemoteInitialState(players: Array<{ peerId: string; name: string }>): ONRemoteState {
  const order = shuffle(players).map((p) => p.peerId);
  const roles = rolesFor(order.length);
  const startingRoles: Record<string, Role> = {};
  order.forEach((id, i) => (startingRoles[id] = roles[i]));
  const centerCards = roles.slice(order.length);
  const logs: Record<string, PrivateLog> = {};
  for (const id of order) logs[id] = {};
  return {
    kind: "reveal",
    playerOrder: order,
    startingRoles,
    currentRoles: { ...startingRoles },
    centerCards,
    confirmed: {},
    logs,
  };
}

function hostOf(players: MinimalPlayer[]): string | undefined {
  return players.find((p) => p.isHost)?.peerId;
}

/** Advance night step to the next one that has an actor, or transition
 *  to day if no more steps. Also records private logs as needed. */
function advanceNightStep(state: Extract<ONRemoteState, { kind: "night" }>): ONRemoteState {
  const order: Array<"werewolves" | "seer" | "robber" | "troublemaker"> = [
    "werewolves",
    "seer",
    "robber",
    "troublemaker",
  ];
  const currentIdx = order.indexOf(state.step);
  for (let i = currentIdx + 1; i < order.length; i++) {
    const nextStep = order[i];
    // If there's any player with that starting role (or it's werewolves),
    // we pause. Werewolves always run (even if there are zero wolves we
    // skip — the remote UI will auto-skip).
    const anyActor = Object.values(state.startingRoles).some((r) =>
      nextStep === "werewolves"
        ? r === "werewolf"
        : nextStep === "seer"
          ? r === "seer"
          : nextStep === "robber"
            ? r === "robber"
            : r === "troublemaker",
    );
    if (anyActor) return { ...state, step: nextStep };
  }
  // Done with night → day.
  return {
    kind: "day",
    playerOrder: state.playerOrder,
    startingRoles: state.startingRoles,
    currentRoles: state.currentRoles,
    centerCards: state.centerCards,
    logs: state.logs,
  };
}

/** Werewolves auto-complete as soon as the reveal phase ends — wolves
 *  just see each other. We auto-skip "werewolves" to seer immediately. */
function autoProcessWerewolves(state: Extract<ONRemoteState, { kind: "night" }>): ONRemoteState {
  const logs = { ...state.logs };
  const wolves = state.playerOrder.filter((id) => state.startingRoles[id] === "werewolf");
  for (const id of wolves) {
    logs[id] = {
      ...logs[id],
      wolfBuddies: wolves.filter((w) => w !== id),
    };
  }
  return advanceNightStep({ ...state, logs });
}

export function onRemoteReducer(
  state: ONRemoteState,
  action: ONRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): ONRemoteState {
  const hostId = hostOf(livePlayers);

  if (action.type === "confirm-role") {
    if (state.kind !== "reveal") return state;
    if (!state.playerOrder.includes(senderPeerId)) return state;
    const nextConfirmed = { ...state.confirmed, [senderPeerId]: true };
    const allConfirmed = state.playerOrder.every((id) => nextConfirmed[id]);
    if (!allConfirmed) return { ...state, confirmed: nextConfirmed };
    // Advance to night; auto-run werewolves step.
    const nightState: Extract<ONRemoteState, { kind: "night" }> = {
      kind: "night",
      playerOrder: state.playerOrder,
      startingRoles: state.startingRoles,
      currentRoles: state.currentRoles,
      centerCards: state.centerCards,
      logs: state.logs,
      step: "werewolves",
      stepDone: {},
    };
    return autoProcessWerewolves(nightState);
  }

  if (action.type === "seer-peek-player" || action.type === "seer-peek-center" || action.type === "seer-skip") {
    if (state.kind !== "night" || state.step !== "seer") return state;
    if (state.startingRoles[senderPeerId] !== "seer") return state;
    const logs = { ...state.logs };
    if (action.type === "seer-peek-player") {
      if (action.targetId === senderPeerId) return state;
      if (!state.playerOrder.includes(action.targetId)) return state;
      // Seer learns the CURRENT role of the target (so if robber already
      // swapped — which can't happen since seer goes first in our order).
      logs[senderPeerId] = {
        ...logs[senderPeerId],
        seerSawPlayer: { targetId: action.targetId, role: state.currentRoles[action.targetId] },
      };
    } else if (action.type === "seer-peek-center") {
      const [a, b] = action.idxs;
      if (a === b || a < 0 || a > 2 || b < 0 || b > 2) return state;
      logs[senderPeerId] = {
        ...logs[senderPeerId],
        seerSawCenter: [
          { idx: a, role: state.centerCards[a] },
          { idx: b, role: state.centerCards[b] },
        ],
      };
    }
    return advanceNightStep({ ...state, logs });
  }

  if (action.type === "robber-swap" || action.type === "robber-skip") {
    if (state.kind !== "night" || state.step !== "robber") return state;
    if (state.startingRoles[senderPeerId] !== "robber") return state;
    const current = { ...state.currentRoles };
    const logs = { ...state.logs };
    if (action.type === "robber-swap") {
      if (action.targetId === senderPeerId) return state;
      if (!state.playerOrder.includes(action.targetId)) return state;
      const theirRole = current[action.targetId];
      const mine = current[senderPeerId];
      current[senderPeerId] = theirRole;
      current[action.targetId] = mine;
      logs[senderPeerId] = {
        ...logs[senderPeerId],
        robberStoleFrom: action.targetId,
        robberNewRole: theirRole,
      };
    }
    return advanceNightStep({ ...state, currentRoles: current, logs });
  }

  if (action.type === "troublemaker-swap" || action.type === "troublemaker-skip") {
    if (state.kind !== "night" || state.step !== "troublemaker") return state;
    if (state.startingRoles[senderPeerId] !== "troublemaker") return state;
    const current = { ...state.currentRoles };
    if (action.type === "troublemaker-swap") {
      const { aId, bId } = action;
      if (aId === bId) return state;
      if (aId === senderPeerId || bId === senderPeerId) return state;
      if (!state.playerOrder.includes(aId) || !state.playerOrder.includes(bId)) return state;
      const tmp = current[aId];
      current[aId] = current[bId];
      current[bId] = tmp;
    }
    return advanceNightStep({ ...state, currentRoles: current });
  }

  if (action.type === "start-day") {
    if (state.kind !== "night") return state;
    if (senderPeerId !== hostId) return state;
    return {
      kind: "day",
      playerOrder: state.playerOrder,
      startingRoles: state.startingRoles,
      currentRoles: state.currentRoles,
      centerCards: state.centerCards,
      logs: state.logs,
    };
  }

  if (action.type === "start-vote") {
    if (state.kind !== "day") return state;
    if (senderPeerId !== hostId) return state;
    return {
      kind: "voting",
      playerOrder: state.playerOrder,
      startingRoles: state.startingRoles,
      currentRoles: state.currentRoles,
      centerCards: state.centerCards,
      logs: state.logs,
      votes: {},
    };
  }

  if (action.type === "vote") {
    if (state.kind !== "voting") return state;
    if (!state.playerOrder.includes(senderPeerId)) return state;
    if (state.votes[senderPeerId]) return state;
    if (!state.playerOrder.includes(action.targetId)) return state;
    if (action.targetId === senderPeerId) return state;
    const nextVotes = { ...state.votes, [senderPeerId]: action.targetId };
    const allIn = state.playerOrder.every((id) => nextVotes[id]);
    if (!allIn) return { ...state, votes: nextVotes };

    // Tally: majority (strict). All players killed if all votes tied at 1.
    const counts = new Map<string, number>();
    for (const t of Object.values(nextVotes)) counts.set(t, (counts.get(t) ?? 0) + 1);
    const max = Math.max(...counts.values());
    const killedIds = max > 1 ? Array.from(counts.entries()).filter(([, c]) => c === max).map(([id]) => id) : [];

    // Win calc.
    const wolvesInPlay = state.playerOrder.filter((id) => state.currentRoles[id] === "werewolf");
    const killedAnyWolf = killedIds.some((id) => state.currentRoles[id] === "werewolf");
    let winner: "village" | "werewolves";
    if (wolvesInPlay.length === 0) {
      winner = killedIds.length === 0 ? "village" : "werewolves";
    } else {
      winner = killedAnyWolf ? "village" : "werewolves";
    }

    return {
      kind: "end",
      playerOrder: state.playerOrder,
      startingRoles: state.startingRoles,
      currentRoles: state.currentRoles,
      centerCards: state.centerCards,
      logs: state.logs,
      votes: nextVotes,
      killedIds,
      winner,
    };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return onRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

/** Insider remote state machine.
 *
 *  One Master (knows the word, answers Y/N), one Insider (also knows
 *  the word, must steer without being caught), rest are Commoners.
 *  Each player sees their own role card on their own device.
 *
 *  Flow:
 *   - reveal: every player confirms they saw their role.
 *   - guessing: Master sees word + Y/N buttons; Commoners/Insider ask
 *     aloud. Any player can dispatch "guessed" when the word is found.
 *     Or host dispatches "timeout" to skip to vote if stuck.
 *   - hunting: discussion window; host dispatches "vote" to start the
 *     hunt vote.
 *   - voting: every alive player votes someone as the insider.
 *   - end: resolve outcome.
 *
 *  This port trims the two-timer UX from local (manual guess buttons +
 *  host-controlled phase advance are clearer in remote). */

import { WORDS } from "./words";

export type InsiderRole = "master" | "insider" | "commoner";

export type InsiderRemoteState =
  | {
      kind: "reveal";
      playerOrder: string[];
      word: string;
      roles: Record<string, InsiderRole>;
      confirmed: Record<string, boolean>;
    }
  | {
      kind: "guessing";
      playerOrder: string[];
      word: string;
      roles: Record<string, InsiderRole>;
    }
  | {
      kind: "hunting";
      playerOrder: string[];
      word: string;
      roles: Record<string, InsiderRole>;
    }
  | {
      kind: "voting";
      playerOrder: string[];
      word: string;
      roles: Record<string, InsiderRole>;
      votes: Record<string, string>;
    }
  | {
      kind: "end";
      playerOrder: string[];
      word: string;
      roles: Record<string, InsiderRole>;
      outcome: "timeout" | "caught" | "escaped";
      votes?: Record<string, string>;
      accusedId?: string;
    };

export type InsiderRemoteAction =
  | { type: "confirm-role" }
  | { type: "guessed" } // any player can mark word found
  | { type: "timeout" } // host: word not found
  | { type: "start-vote" } // host: hunting → voting
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

export function insiderRemoteInitialState(
  players: Array<{ peerId: string; name: string }>,
): InsiderRemoteState {
  const order = shuffle(players).map((p) => p.peerId);
  const idxs = shuffle(order.map((_, i) => i));
  const masterIdx = idxs[0];
  const insiderIdx = idxs[1];
  const roles: Record<string, InsiderRole> = {};
  order.forEach((id, i) => {
    roles[id] = i === masterIdx ? "master" : i === insiderIdx ? "insider" : "commoner";
  });
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  return {
    kind: "reveal",
    playerOrder: order,
    word,
    roles,
    confirmed: {},
  };
}

function hostOf(players: MinimalPlayer[]): string | undefined {
  return players.find((p) => p.isHost)?.peerId;
}

export function insiderRemoteReducer(
  state: InsiderRemoteState,
  action: InsiderRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): InsiderRemoteState {
  const hostId = hostOf(livePlayers);

  if (action.type === "confirm-role") {
    if (state.kind !== "reveal") return state;
    if (!state.playerOrder.includes(senderPeerId)) return state;
    const nextConfirmed = { ...state.confirmed, [senderPeerId]: true };
    const allConfirmed = state.playerOrder.every((id) => nextConfirmed[id]);
    if (!allConfirmed) return { ...state, confirmed: nextConfirmed };
    return {
      kind: "guessing",
      playerOrder: state.playerOrder,
      word: state.word,
      roles: state.roles,
    };
  }

  if (action.type === "guessed") {
    if (state.kind !== "guessing") return state;
    if (!state.playerOrder.includes(senderPeerId)) return state;
    return {
      kind: "hunting",
      playerOrder: state.playerOrder,
      word: state.word,
      roles: state.roles,
    };
  }

  if (action.type === "timeout") {
    if (state.kind !== "guessing") return state;
    if (senderPeerId !== hostId) return state;
    return {
      kind: "end",
      playerOrder: state.playerOrder,
      word: state.word,
      roles: state.roles,
      outcome: "timeout",
    };
  }

  if (action.type === "start-vote") {
    if (state.kind !== "hunting") return state;
    if (senderPeerId !== hostId) return state;
    return {
      kind: "voting",
      playerOrder: state.playerOrder,
      word: state.word,
      roles: state.roles,
      votes: {},
    };
  }

  if (action.type === "vote") {
    if (state.kind !== "voting") return state;
    if (!state.playerOrder.includes(senderPeerId)) return state;
    if (state.votes[senderPeerId]) return state;
    if (!state.playerOrder.includes(action.targetId)) return state;
    const nextVotes = { ...state.votes, [senderPeerId]: action.targetId };
    const allIn = state.playerOrder.every((id) => nextVotes[id]);
    if (!allIn) return { ...state, votes: nextVotes };
    const counts = new Map<string, number>();
    for (const t of Object.values(nextVotes)) counts.set(t, (counts.get(t) ?? 0) + 1);
    const max = Math.max(...counts.values());
    const top = Array.from(counts.entries()).filter(([, c]) => c === max).map(([id]) => id);
    const accusedId = top.length === 1 ? top[0] : undefined;
    const insiderId = Object.entries(state.roles).find(([, r]) => r === "insider")?.[0];
    const caught = accusedId && accusedId === insiderId;
    return {
      kind: "end",
      playerOrder: state.playerOrder,
      word: state.word,
      roles: state.roles,
      outcome: caught ? "caught" : "escaped",
      votes: nextVotes,
      accusedId,
    };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return insiderRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

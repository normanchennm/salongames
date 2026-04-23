/** Code Names remote state machine.
 *
 *  Big remote win: spymasters see the color grid on their own device
 *  while everyone else sees just the words. No more pass-the-phone
 *  dance to hide colors from the table.
 *
 *  Roster: auto-split into teams A/B (first half / second half of
 *  player list at game start). First listed on each team is its
 *  spymaster. Host can later adjust via future UI; for v1 we take
 *  what we get at start time. */

import { CODENAMES_WORDS } from "./words";

const GRID_SIZE = 25;

export type CardColor = "A" | "B" | "neutral" | "assassin";
export interface Card {
  word: string;
  color: CardColor;
  revealed: boolean;
}

export interface CNRoster {
  teamAIds: string[];
  teamBIds: string[];
  spymasterAId: string;
  spymasterBId: string;
}

export type CNRemoteState =
  | {
      kind: "playing";
      roster: CNRoster;
      first: "A" | "B";
      team: "A" | "B";
      turnPhase: "clue" | "guess"; // "clue" = waiting for spymaster clue, "guess" = team can reveal
      clue: { word: string; num: number } | null;
      guessesThisTurn: number;
      cards: Card[];
    }
  | {
      kind: "end";
      roster: CNRoster;
      cards: Card[];
      winner: "A" | "B";
      reason: string;
      first: "A" | "B";
    };

export type CNRemoteAction =
  | { type: "submit-clue"; word: string; num: number }
  | { type: "reveal"; index: number }
  | { type: "end-turn" }
  | { type: "play-again" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

function dealCards(first: "A" | "B"): Card[] {
  const shuffled = CODENAMES_WORDS.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chosen = shuffled.slice(0, GRID_SIZE);
  const aCount = first === "A" ? 9 : 8;
  const bCount = first === "B" ? 9 : 8;
  const colors: CardColor[] = [];
  for (let i = 0; i < aCount; i++) colors.push("A");
  for (let i = 0; i < bCount; i++) colors.push("B");
  for (let i = 0; i < 7; i++) colors.push("neutral");
  colors.push("assassin");
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  return chosen.map((w, i) => ({ word: w, color: colors[i], revealed: false }));
}

function buildRoster(playerOrder: string[]): CNRoster {
  const half = Math.ceil(playerOrder.length / 2);
  const teamAIds = playerOrder.slice(0, half);
  const teamBIds = playerOrder.slice(half);
  return {
    teamAIds,
    teamBIds,
    spymasterAId: teamAIds[0],
    spymasterBId: teamBIds[0],
  };
}

export function cnRemoteInitialState(players: Array<{ peerId: string; name: string }>): CNRemoteState {
  const order = players.map((p) => p.peerId);
  // Shuffle so teams aren't always in join order.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const roster = buildRoster(order);
  const first: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
  return {
    kind: "playing",
    roster,
    first,
    team: first,
    turnPhase: "clue",
    clue: null,
    guessesThisTurn: 0,
    cards: dealCards(first),
  };
}

function countRemaining(cards: Card[], color: CardColor): number {
  return cards.filter((c) => c.color === color && !c.revealed).length;
}

function isSpymasterOf(team: "A" | "B", peerId: string, roster: CNRoster): boolean {
  return team === "A" ? roster.spymasterAId === peerId : roster.spymasterBId === peerId;
}

function isOnTeam(team: "A" | "B", peerId: string, roster: CNRoster): boolean {
  return team === "A" ? roster.teamAIds.includes(peerId) : roster.teamBIds.includes(peerId);
}

export function cnRemoteReducer(
  state: CNRemoteState,
  action: CNRemoteAction,
  senderPeerId: string,
  players: MinimalPlayer[],
): CNRemoteState {
  const sender = players.find((p) => p.peerId === senderPeerId);
  if (!sender) return state;

  if (action.type === "submit-clue") {
    if (state.kind !== "playing") return state;
    if (state.turnPhase !== "clue") return state;
    if (!isSpymasterOf(state.team, senderPeerId, state.roster)) return state;
    const word = action.word.trim();
    if (!word) return state;
    const num = Math.max(0, Math.min(9, Math.round(action.num)));
    return {
      ...state,
      clue: { word, num },
      turnPhase: "guess",
      guessesThisTurn: 0,
    };
  }

  if (action.type === "reveal") {
    if (state.kind !== "playing") return state;
    if (state.turnPhase !== "guess") return state;
    if (!isOnTeam(state.team, senderPeerId, state.roster)) return state;
    if (isSpymasterOf(state.team, senderPeerId, state.roster)) return state;

    const card = state.cards[action.index];
    if (!card || card.revealed) return state;
    const nextCards = state.cards.slice();
    nextCards[action.index] = { ...card, revealed: true };
    const nextTeam: "A" | "B" = state.team === "A" ? "B" : "A";

    // Endgame checks
    if (card.color === "assassin") {
      return {
        kind: "end",
        roster: state.roster,
        cards: nextCards,
        winner: nextTeam,
        reason: `Team ${state.team} hit the Assassin`,
        first: state.first,
      };
    }
    if (countRemaining(nextCards, "A") === 0) {
      return {
        kind: "end",
        roster: state.roster,
        cards: nextCards,
        winner: "A",
        reason: "Team A revealed all their words",
        first: state.first,
      };
    }
    if (countRemaining(nextCards, "B") === 0) {
      return {
        kind: "end",
        roster: state.roster,
        cards: nextCards,
        winner: "B",
        reason: "Team B revealed all their words",
        first: state.first,
      };
    }

    // Correct color: continue guessing.
    if (card.color === state.team) {
      return {
        ...state,
        cards: nextCards,
        guessesThisTurn: state.guessesThisTurn + 1,
      };
    }
    // Wrong color (neutral or opponent): swap team, back to clue phase.
    return {
      ...state,
      cards: nextCards,
      team: nextTeam,
      turnPhase: "clue",
      clue: null,
      guessesThisTurn: 0,
    };
  }

  if (action.type === "end-turn") {
    if (state.kind !== "playing") return state;
    if (state.turnPhase !== "guess") return state;
    if (!isOnTeam(state.team, senderPeerId, state.roster)) return state;
    if (isSpymasterOf(state.team, senderPeerId, state.roster)) return state;
    if (state.guessesThisTurn === 0) return state; // must have guessed at least once
    const nextTeam: "A" | "B" = state.team === "A" ? "B" : "A";
    return {
      ...state,
      team: nextTeam,
      turnPhase: "clue",
      clue: null,
      guessesThisTurn: 0,
    };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    const hostId = players.find((p) => p.isHost)?.peerId;
    if (senderPeerId !== hostId) return state;
    const active = players.filter((p) => p.online);
    return cnRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

/** Public helper so the UI can decide whether to show colors. */
export function canSeeColors(peerId: string, roster: CNRoster): boolean {
  return roster.spymasterAId === peerId || roster.spymasterBId === peerId;
}

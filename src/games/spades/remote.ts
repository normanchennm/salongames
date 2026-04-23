/** Spades remote state machine.
 *
 *  4 players in partnerships (seats 0+2 vs 1+3). Each player's hand is
 *  private. Bidding phase is simultaneous (each player picks 0-13 on
 *  their own device). Playing: follow suit, spades trump, spades can't
 *  lead until broken. Single-hand scoring. */

export const SUITS = ["♣", "♦", "♥", "♠"] as const;
export const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"] as const;
export const RANK_VAL: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export interface Card { rank: Rank; suit: Suit }

export interface Trick {
  leadSuit: Suit | null;
  plays: Array<{ playerId: string; card: Card }>;
  leaderIdx: number;
}

export type SpadesRemoteState =
  | {
      kind: "bidding";
      playerOrder: string[]; // length 4
      hands: Record<string, Card[]>;
      bids: Record<string, number>;
    }
  | {
      kind: "playing";
      playerOrder: string[];
      hands: Record<string, Card[]>;
      bids: Record<string, number>;
      takes: number[]; // per player index
      trickNo: number;
      trick: Trick;
      currentIdx: number;
      spadesBroken: boolean;
    }
  | {
      kind: "trick-end";
      playerOrder: string[];
      hands: Record<string, Card[]>;
      bids: Record<string, number>;
      takes: number[];
      trickNo: number;
      trick: Trick;
      winningIdx: number;
      spadesBroken: boolean;
    }
  | {
      kind: "end";
      playerOrder: string[];
      bids: Record<string, number>;
      takes: number[];
      teamScores: [number, number]; // teamA = seats 0+2, teamB = 1+3
    };

export type SpadesRemoteAction =
  | { type: "bid"; amount: number }
  | { type: "play-card"; card: Card }
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

export function cardKey(c: Card): string {
  return c.rank + c.suit;
}

function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  return shuffle(deck);
}

export function spadesRemoteInitialState(
  players: Array<{ peerId: string; name: string }>,
): SpadesRemoteState {
  const first4 = players.slice(0, 4);
  const playerOrder = first4.map((p) => p.peerId);
  const deck = freshDeck();
  const hands: Record<string, Card[]> = {};
  playerOrder.forEach((id, i) => {
    hands[id] = deck.slice(i * 13, (i + 1) * 13);
  });
  return {
    kind: "bidding",
    playerOrder,
    hands,
    bids: {},
  };
}

function isValidPlay(state: Extract<SpadesRemoteState, { kind: "playing" }>, peerId: string, card: Card): boolean {
  const idx = state.playerOrder.indexOf(peerId);
  if (idx !== state.currentIdx) return false;
  const hand = state.hands[peerId];
  if (!hand.some((c) => c.rank === card.rank && c.suit === card.suit)) return false;
  const isLeading = state.trick.plays.length === 0;
  if (isLeading) {
    if (card.suit === "♠" && !state.spadesBroken) {
      const hasOther = hand.some((c) => c.suit !== "♠");
      if (hasOther) return false;
    }
    return true;
  }
  const leadSuit = state.trick.leadSuit!;
  const hasLead = hand.some((c) => c.suit === leadSuit);
  if (hasLead && card.suit !== leadSuit) return false;
  return true;
}

function winnerOfTrick(trick: Trick, playerOrder: string[]): number {
  // Highest spade wins; otherwise highest of lead suit.
  const spades = trick.plays.filter((p) => p.card.suit === "♠");
  if (spades.length > 0) {
    const top = spades.reduce((best, p) => (RANK_VAL[p.card.rank] > RANK_VAL[best.card.rank] ? p : best));
    return playerOrder.indexOf(top.playerId);
  }
  const lead = trick.leadSuit;
  const ofLead = trick.plays.filter((p) => p.card.suit === lead);
  const top = ofLead.reduce((best, p) => (RANK_VAL[p.card.rank] > RANK_VAL[best.card.rank] ? p : best));
  return playerOrder.indexOf(top.playerId);
}

function scoreHand(bids: Record<string, number>, takes: number[], playerOrder: string[]): [number, number] {
  const bidA = (bids[playerOrder[0]] ?? 0) + (bids[playerOrder[2]] ?? 0);
  const bidB = (bids[playerOrder[1]] ?? 0) + (bids[playerOrder[3]] ?? 0);
  const takeA = takes[0] + takes[2];
  const takeB = takes[1] + takes[3];
  const scoreA = takeA >= bidA ? 10 * bidA + (takeA - bidA) : -10 * bidA;
  const scoreB = takeB >= bidB ? 10 * bidB + (takeB - bidB) : -10 * bidB;
  return [scoreA, scoreB];
}

export function spadesRemoteReducer(
  state: SpadesRemoteState,
  action: SpadesRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): SpadesRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "bid") {
    if (state.kind !== "bidding") return state;
    const idx = state.playerOrder.indexOf(senderPeerId);
    if (idx < 0) return state;
    if (state.bids[senderPeerId] !== undefined) return state;
    const amount = Math.max(0, Math.min(13, Math.floor(action.amount)));
    const nextBids = { ...state.bids, [senderPeerId]: amount };
    const allIn = state.playerOrder.every((id) => nextBids[id] !== undefined);
    if (!allIn) return { ...state, bids: nextBids };
    return {
      kind: "playing",
      playerOrder: state.playerOrder,
      hands: state.hands,
      bids: nextBids,
      takes: [0, 0, 0, 0],
      trickNo: 0,
      trick: { leadSuit: null, plays: [], leaderIdx: 0 },
      currentIdx: 0, // seat 0 leads (simplified; classic rotates)
      spadesBroken: false,
    };
  }

  if (action.type === "play-card") {
    if (state.kind !== "playing") return state;
    if (!isValidPlay(state, senderPeerId, action.card)) return state;
    const newHand = state.hands[senderPeerId].filter(
      (c) => !(c.rank === action.card.rank && c.suit === action.card.suit),
    );
    const nextHands = { ...state.hands, [senderPeerId]: newHand };
    const nextTrick: Trick = {
      leadSuit: state.trick.leadSuit ?? action.card.suit,
      plays: [...state.trick.plays, { playerId: senderPeerId, card: action.card }],
      leaderIdx: state.trick.leaderIdx,
    };
    const spadesBroken = state.spadesBroken || action.card.suit === "♠";
    if (nextTrick.plays.length < 4) {
      return {
        ...state,
        hands: nextHands,
        trick: nextTrick,
        currentIdx: (state.currentIdx + 1) % 4,
        spadesBroken,
      };
    }
    const winIdx = winnerOfTrick(nextTrick, state.playerOrder);
    return {
      kind: "trick-end",
      playerOrder: state.playerOrder,
      hands: nextHands,
      bids: state.bids,
      takes: state.takes,
      trickNo: state.trickNo,
      trick: nextTrick,
      winningIdx: winIdx,
      spadesBroken,
    };
  }

  if (action.type === "continue") {
    if (state.kind !== "trick-end") return state;
    if (senderPeerId !== hostId) return state;
    const nextTakes = state.takes.slice();
    nextTakes[state.winningIdx] += 1;
    const nextTrickNo = state.trickNo + 1;
    if (nextTrickNo >= 13) {
      const teamScores = scoreHand(state.bids, nextTakes, state.playerOrder);
      return {
        kind: "end",
        playerOrder: state.playerOrder,
        bids: state.bids,
        takes: nextTakes,
        teamScores,
      };
    }
    return {
      kind: "playing",
      playerOrder: state.playerOrder,
      hands: state.hands,
      bids: state.bids,
      takes: nextTakes,
      trickNo: nextTrickNo,
      trick: { leadSuit: null, plays: [], leaderIdx: state.winningIdx },
      currentIdx: state.winningIdx,
      spadesBroken: state.spadesBroken,
    };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return spadesRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

export function isValidPlayExternal(
  state: SpadesRemoteState,
  peerId: string,
  card: Card,
): boolean {
  if (state.kind !== "playing") return false;
  return isValidPlay(state, peerId, card);
}

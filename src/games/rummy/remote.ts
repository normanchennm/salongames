/** Rummy remote state machine.
 *
 *  2 players. Each hand is private per device. Turn loop: draw (stock
 *  or discard pile) then discard one card. Or go out if your remaining
 *  cards partition into valid melds. */

export const SUITS = ["♣", "♦", "♥", "♠"] as const;
export const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"] as const;
export const RANK_VAL: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]));

export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export interface Card { rank: Rank; suit: Suit }

export type RummyRemoteState =
  | {
      kind: "playing";
      playerOrder: string[]; // length 2
      hands: Record<string, Card[]>;
      stock: Card[];
      discard: Card[];
      turnIdx: number;
      drew: boolean;
    }
  | {
      kind: "end";
      playerOrder: string[];
      hands: Record<string, Card[]>;
      winnerIdx: number;
      deadwood: number;
    };

export type RummyRemoteAction =
  | { type: "draw-stock" }
  | { type: "draw-discard" }
  | { type: "discard"; card: Card }
  | { type: "go-out" }
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

export function deadwoodValue(c: Card): number {
  if (c.rank === "A") return 1;
  if (c.rank === "J" || c.rank === "Q" || c.rank === "K") return 10;
  return RANK_VAL[c.rank];
}

function validMeld(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  if (cards.every((c) => c.rank === cards[0].rank)) return true;
  if (cards.every((c) => c.suit === cards[0].suit)) {
    const sorted = cards.map((c) => RANK_VAL[c.rank]).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) return false;
    }
    return true;
  }
  return false;
}

export function canPartition(hand: Card[]): boolean {
  if (hand.length === 0) return true;
  if (hand.length < 3) return false;
  const first = hand[0];
  const rest = hand.slice(1);
  for (let size = 3; size <= hand.length; size++) {
    const indices: number[][] = [];
    const pick = (start: number, need: number, acc: number[]) => {
      if (need === 0) { indices.push(acc); return; }
      for (let i = start; i <= rest.length - need; i++) {
        pick(i + 1, need - 1, [...acc, i]);
      }
    };
    pick(0, size - 1, []);
    for (const combo of indices) {
      const meld = [first, ...combo.map((i) => rest[i])];
      if (!validMeld(meld)) continue;
      const remaining = rest.filter((_, i) => !combo.includes(i));
      if (canPartition(remaining)) return true;
    }
  }
  return false;
}

function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  return shuffle(deck);
}

export function rummyRemoteInitialState(
  players: Array<{ peerId: string; name: string }>,
): RummyRemoteState {
  const first2 = players.slice(0, 2);
  const playerOrder = first2.map((p) => p.peerId);
  const deck = freshDeck();
  const hands: Record<string, Card[]> = {
    [playerOrder[0]]: deck.slice(0, 7),
    [playerOrder[1]]: deck.slice(7, 14),
  };
  const discard = [deck[14]];
  const stock = deck.slice(15);
  return {
    kind: "playing",
    playerOrder,
    hands,
    stock,
    discard,
    turnIdx: 0,
    drew: false,
  };
}

export function rummyRemoteReducer(
  state: RummyRemoteState,
  action: RummyRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): RummyRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (state.kind === "playing") {
    const myIdx = state.playerOrder.indexOf(senderPeerId);
    if (myIdx !== state.turnIdx) return state;
    const myKey = senderPeerId;

    if (action.type === "draw-stock") {
      if (state.drew) return state;
      if (state.stock.length === 0) return state;
      const card = state.stock[state.stock.length - 1];
      return {
        ...state,
        stock: state.stock.slice(0, -1),
        hands: { ...state.hands, [myKey]: [...state.hands[myKey], card] },
        drew: true,
      };
    }

    if (action.type === "draw-discard") {
      if (state.drew) return state;
      if (state.discard.length === 0) return state;
      const card = state.discard[state.discard.length - 1];
      return {
        ...state,
        discard: state.discard.slice(0, -1),
        hands: { ...state.hands, [myKey]: [...state.hands[myKey], card] },
        drew: true,
      };
    }

    if (action.type === "discard") {
      if (!state.drew) return state;
      const hand = state.hands[myKey];
      if (!hand.some((c) => cardKey(c) === cardKey(action.card))) return state;
      const newHand = hand.filter((c) => cardKey(c) !== cardKey(action.card));
      const nextIdx = (state.turnIdx + 1) % 2;
      return {
        ...state,
        hands: { ...state.hands, [myKey]: newHand },
        discard: [...state.discard, action.card],
        turnIdx: nextIdx,
        drew: false,
      };
    }

    if (action.type === "go-out") {
      if (!canPartition(state.hands[myKey])) return state;
      const oppIdx = 1 - state.turnIdx;
      const oppHand = state.hands[state.playerOrder[oppIdx]];
      const deadwood = oppHand.reduce((s, c) => s + deadwoodValue(c), 0);
      return {
        kind: "end",
        playerOrder: state.playerOrder,
        hands: state.hands,
        winnerIdx: state.turnIdx,
        deadwood,
      };
    }
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return rummyRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

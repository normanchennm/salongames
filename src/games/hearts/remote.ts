/** Hearts remote state machine.
 *
 *  4 players, each hand is private per device. Reducer enforces:
 *   - 2♣ leads the first trick
 *   - Follow suit if possible
 *   - No ♥ / Q♠ on the first trick
 *   - ♥ can only lead once broken
 *   - Trick winner leads next
 *
 *  One hand only (matches local). Shoot-the-moon scoring applied at
 *  end of hand. */

export const SUITS = ["♣", "♦", "♠", "♥"] as const;
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

export type HeartsRemoteState =
  | {
      kind: "playing";
      playerOrder: string[]; // length 4
      hands: Record<string, Card[]>; // per-player private hand
      scores: number[]; // indexed by playerOrder position
      trickNo: number;
      trick: Trick;
      currentIdx: number;
      heartsBroken: boolean;
    }
  | {
      kind: "trick-end";
      playerOrder: string[];
      hands: Record<string, Card[]>;
      scores: number[];
      trickNo: number;
      trick: Trick;
      winningIdx: number;
      points: number;
      heartsBroken: boolean;
    }
  | {
      kind: "end";
      playerOrder: string[];
      scores: number[];
      moonShooterIdx: number | null;
    };

export type HeartsRemoteAction =
  | { type: "play-card"; card: Card }
  | { type: "continue" } // host advances past trick-end
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
export function cardPoints(c: Card): number {
  if (c.suit === "♥") return 1;
  if (c.suit === "♠" && c.rank === "Q") return 13;
  return 0;
}

function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  return shuffle(deck);
}

export function heartsRemoteInitialState(
  players: Array<{ peerId: string; name: string }>,
): HeartsRemoteState {
  const first4 = players.slice(0, 4);
  const playerOrder = first4.map((p) => p.peerId);
  const deck = freshDeck();
  const hands: Record<string, Card[]> = {};
  playerOrder.forEach((id, i) => {
    hands[id] = deck.slice(i * 13, (i + 1) * 13);
  });
  // Find leader (has 2♣)
  let leaderIdx = 0;
  for (let i = 0; i < playerOrder.length; i++) {
    if (hands[playerOrder[i]].some((c) => c.rank === "2" && c.suit === "♣")) {
      leaderIdx = i;
      break;
    }
  }
  return {
    kind: "playing",
    playerOrder,
    hands,
    scores: [0, 0, 0, 0],
    trickNo: 0,
    trick: { leadSuit: null, plays: [], leaderIdx },
    currentIdx: leaderIdx,
    heartsBroken: false,
  };
}

function isValidPlay(state: Extract<HeartsRemoteState, { kind: "playing" }>, peerId: string, card: Card): boolean {
  const idx = state.playerOrder.indexOf(peerId);
  if (idx !== state.currentIdx) return false;
  const hand = state.hands[peerId];
  if (!hand.some((c) => c.rank === card.rank && c.suit === card.suit)) return false;
  const isLeading = state.trick.plays.length === 0;
  const isFirstTrick = state.trickNo === 0;

  if (isLeading) {
    if (isFirstTrick) {
      // Must lead 2♣.
      if (!(card.rank === "2" && card.suit === "♣")) return false;
    } else {
      // Hearts can lead only if broken, unless only hearts in hand.
      if (card.suit === "♥" && !state.heartsBroken) {
        const hasOther = hand.some((c) => c.suit !== "♥");
        if (hasOther) return false;
      }
    }
    return true;
  }

  // Following: must follow suit if possible.
  const leadSuit = state.trick.leadSuit!;
  const hasLead = hand.some((c) => c.suit === leadSuit);
  if (hasLead && card.suit !== leadSuit) return false;
  if (isFirstTrick) {
    // No points on first trick unless you have nothing else.
    if (cardPoints(card) > 0) {
      const hasSafe = hand.some((c) => cardPoints(c) === 0);
      if (hasSafe) return false;
    }
  }
  return true;
}

function winnerOfTrick(trick: Trick, playerOrder: string[]): number {
  const leadSuit = trick.leadSuit;
  let bestIdxInPlays = 0;
  let bestVal = -1;
  for (let i = 0; i < trick.plays.length; i++) {
    const { card } = trick.plays[i];
    if (card.suit !== leadSuit) continue;
    const v = RANK_VAL[card.rank];
    if (v > bestVal) {
      bestVal = v;
      bestIdxInPlays = i;
    }
  }
  return playerOrder.indexOf(trick.plays[bestIdxInPlays].playerId);
}

export function heartsRemoteReducer(
  state: HeartsRemoteState,
  action: HeartsRemoteAction,
  senderPeerId: string,
  livePlayers: MinimalPlayer[],
): HeartsRemoteState {
  const hostId = livePlayers.find((p) => p.isHost)?.peerId;

  if (action.type === "play-card") {
    if (state.kind !== "playing") return state;
    if (!isValidPlay(state, senderPeerId, action.card)) return state;
    // Remove card from hand, add to trick.
    const newHand = state.hands[senderPeerId].filter(
      (c) => !(c.rank === action.card.rank && c.suit === action.card.suit),
    );
    const nextHands = { ...state.hands, [senderPeerId]: newHand };
    const nextTrick: Trick = {
      leadSuit: state.trick.leadSuit ?? action.card.suit,
      plays: [...state.trick.plays, { playerId: senderPeerId, card: action.card }],
      leaderIdx: state.trick.leaderIdx,
    };
    const heartsBroken = state.heartsBroken || action.card.suit === "♥";

    if (nextTrick.plays.length < 4) {
      return {
        ...state,
        hands: nextHands,
        trick: nextTrick,
        currentIdx: (state.currentIdx + 1) % 4,
        heartsBroken,
      };
    }
    // Trick complete
    const winIdx = winnerOfTrick(nextTrick, state.playerOrder);
    const points = nextTrick.plays.reduce((sum, p) => sum + cardPoints(p.card), 0);
    return {
      kind: "trick-end",
      playerOrder: state.playerOrder,
      hands: nextHands,
      scores: state.scores,
      trickNo: state.trickNo,
      trick: nextTrick,
      winningIdx: winIdx,
      points,
      heartsBroken,
    };
  }

  if (action.type === "continue") {
    if (state.kind !== "trick-end") return state;
    if (senderPeerId !== hostId) return state;
    const nextScores = state.scores.slice();
    nextScores[state.winningIdx] += state.points;
    const nextTrickNo = state.trickNo + 1;
    if (nextTrickNo >= 13) {
      // End of hand. Check moon shoot.
      const moon = nextScores.findIndex((s) => s === 26);
      let finalScores = nextScores.slice();
      let moonShooterIdx: number | null = null;
      if (moon >= 0) {
        moonShooterIdx = moon;
        finalScores = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) if (i !== moon) finalScores[i] = 26;
      }
      return {
        kind: "end",
        playerOrder: state.playerOrder,
        scores: finalScores,
        moonShooterIdx,
      };
    }
    return {
      kind: "playing",
      playerOrder: state.playerOrder,
      hands: state.hands,
      scores: nextScores,
      trickNo: nextTrickNo,
      trick: { leadSuit: null, plays: [], leaderIdx: state.winningIdx },
      currentIdx: state.winningIdx,
      heartsBroken: state.heartsBroken,
    };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = livePlayers.filter((p) => p.online);
    return heartsRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

export function isValidPlayExternal(
  state: HeartsRemoteState,
  peerId: string,
  card: Card,
): boolean {
  if (state.kind !== "playing") return false;
  return isValidPlay(state, peerId, card);
}

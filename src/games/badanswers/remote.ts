/** Bad Answers remote state machine.
 *
 *  Each player sees their own 7-card hand on their device — no more
 *  passing phones to hide cards. Rotating Judge. Non-judge players
 *  pick a card privately; host shuffles and anonymizes. Judge picks
 *  the winner. First to WIN_POINTS wins.
 *
 *  Note on privacy: hands live in the authoritative host state which
 *  is broadcast to all peers. The UI only shows each player their own
 *  hand. A determined user running devtools could peek; for a party
 *  game this tradeoff is the same one Code Names makes (the color
 *  grid is in broadcast state too). We accept weak privacy. */

import { PROMPTS, RESPONSES } from "./cards";

export const HAND_SIZE = 7;
export const WIN_POINTS = 5;

export interface PlayerHand {
  playerId: string;
  cards: string[];
}

export interface Submission {
  id: string;        // stable id for the judge to pick (doesn't reveal who authored)
  authorId: string;  // host-side: who wrote it (for scoring + reveal)
  text: string;
}

export type BARemoteState =
  | {
      kind: "submit";
      round: number;
      judgeId: string;
      prompt: string;
      hands: PlayerHand[];
      submissions: Submission[];
      deck: string[];
      promptQueue: string[];
      scores: Record<string, number>;
    }
  | {
      kind: "judge";
      round: number;
      judgeId: string;
      prompt: string;
      hands: PlayerHand[];
      submissions: Submission[];
      deck: string[];
      promptQueue: string[];
      scores: Record<string, number>;
    }
  | {
      kind: "reveal";
      round: number;
      judgeId: string;
      prompt: string;
      winner: Submission;
      submissions: Submission[];
      hands: PlayerHand[];
      deck: string[];
      promptQueue: string[];
      scores: Record<string, number>;
    }
  | { kind: "end"; scores: Record<string, number> };

export type BARemoteAction =
  | { type: "submit-card"; text: string } // peer sends their chosen card text
  | { type: "pick-winner"; submissionId: string }
  | { type: "next-round" }
  | { type: "play-again" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

function shuffled<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function drawCards(deck: string[], n: number): { drawn: string[]; rest: string[] } {
  if (deck.length >= n) return { drawn: deck.slice(0, n), rest: deck.slice(n) };
  // Reshuffle — in practice the response deck is big enough that this
  // shouldn't trigger, but guard anyway.
  const reshuffled = shuffled(RESPONSES.map((r) => r.text));
  return { drawn: reshuffled.slice(0, n), rest: reshuffled.slice(n) };
}

export function baRemoteInitialState(players: Array<{ peerId: string; name: string }>): BARemoteState {
  const promptsDeck = shuffled(PROMPTS.map((p) => p.text));
  let responseDeck = shuffled(RESPONSES.map((r) => r.text));
  const hands: PlayerHand[] = players.map((p) => {
    const { drawn, rest } = drawCards(responseDeck, HAND_SIZE);
    responseDeck = rest;
    return { playerId: p.peerId, cards: drawn };
  });
  const [prompt, ...promptQueue] = promptsDeck;
  const scores: Record<string, number> = {};
  for (const p of players) scores[p.peerId] = 0;
  // First judge: first player in list.
  return {
    kind: "submit",
    round: 0,
    judgeId: players[0]?.peerId ?? "",
    prompt,
    hands,
    submissions: [],
    deck: responseDeck,
    promptQueue,
    scores,
  };
}

function nextJudgeId(currentJudgeId: string, playerOrder: string[]): string {
  const idx = playerOrder.indexOf(currentJudgeId);
  if (idx < 0) return playerOrder[0] ?? currentJudgeId;
  return playerOrder[(idx + 1) % playerOrder.length];
}

function shuffleSubmissions(subs: Submission[]): Submission[] {
  return shuffled(subs);
}

export function baRemoteReducer(
  state: BARemoteState,
  action: BARemoteAction,
  senderPeerId: string,
  players: MinimalPlayer[],
): BARemoteState {
  const sender = players.find((p) => p.peerId === senderPeerId);
  if (!sender) return state;
  const hostId = players.find((p) => p.isHost)?.peerId;

  if (action.type === "submit-card") {
    if (state.kind !== "submit") return state;
    if (senderPeerId === state.judgeId) return state;
    if (!sender.online) return state;
    // Must be one of the sender's cards.
    const hand = state.hands.find((h) => h.playerId === senderPeerId);
    if (!hand) return state;
    const cardIdx = hand.cards.indexOf(action.text);
    if (cardIdx < 0) return state;
    // Already submitted?
    if (state.submissions.some((s) => s.authorId === senderPeerId)) return state;

    // Pop card from hand, draw a replacement to keep hands at HAND_SIZE.
    const nextCards = hand.cards.slice();
    nextCards.splice(cardIdx, 1);
    const { drawn, rest } = drawCards(state.deck, 1);
    if (drawn.length > 0) nextCards.push(drawn[0]);

    const nextHands = state.hands.map((h) =>
      h.playerId === senderPeerId ? { ...h, cards: nextCards } : h,
    );

    const subId = `${senderPeerId}:${state.round}`;
    const nextSubmissions = [
      ...state.submissions,
      { id: subId, authorId: senderPeerId, text: action.text },
    ];

    // All non-judge online players submitted?
    const eligible = players.filter((p) => p.online && p.peerId !== state.judgeId).map((p) => p.peerId);
    const allIn = eligible.every((id) => nextSubmissions.some((s) => s.authorId === id));

    if (!allIn) {
      return {
        ...state,
        hands: nextHands,
        submissions: nextSubmissions,
        deck: rest,
      };
    }
    return {
      kind: "judge",
      round: state.round,
      judgeId: state.judgeId,
      prompt: state.prompt,
      hands: nextHands,
      submissions: shuffleSubmissions(nextSubmissions),
      deck: rest,
      promptQueue: state.promptQueue,
      scores: state.scores,
    };
  }

  if (action.type === "pick-winner") {
    if (state.kind !== "judge") return state;
    if (senderPeerId !== state.judgeId) return state;
    const winner = state.submissions.find((s) => s.id === action.submissionId);
    if (!winner) return state;
    const nextScores = { ...state.scores, [winner.authorId]: (state.scores[winner.authorId] ?? 0) + 1 };
    return {
      kind: "reveal",
      round: state.round,
      judgeId: state.judgeId,
      prompt: state.prompt,
      winner,
      submissions: state.submissions,
      hands: state.hands,
      deck: state.deck,
      promptQueue: state.promptQueue,
      scores: nextScores,
    };
  }

  if (action.type === "next-round") {
    if (state.kind !== "reveal") return state;
    if (senderPeerId !== hostId) return state;
    // Check win condition.
    const winnerScore = Math.max(...Object.values(state.scores), 0);
    if (winnerScore >= WIN_POINTS) {
      return { kind: "end", scores: state.scores };
    }
    // Rotate judge to next online player.
    const online = players.filter((p) => p.online).map((p) => p.peerId);
    const nextJudge = nextJudgeId(state.judgeId, online.length > 0 ? online : [state.judgeId]);
    const [nextPrompt, ...restQueue] = state.promptQueue;
    if (!nextPrompt) {
      return { kind: "end", scores: state.scores };
    }
    return {
      kind: "submit",
      round: state.round + 1,
      judgeId: nextJudge,
      prompt: nextPrompt,
      hands: state.hands,
      submissions: [],
      deck: state.deck,
      promptQueue: restQueue,
      scores: state.scores,
    };
  }

  if (action.type === "play-again") {
    if (state.kind !== "end") return state;
    if (senderPeerId !== hostId) return state;
    const active = players.filter((p) => p.online);
    return baRemoteInitialState(active.map((p) => ({ peerId: p.peerId, name: p.name })));
  }

  return state;
}

/** Small helper the UI can use: is there a hand for peerId? */
export function handFor(state: BARemoteState, peerId: string): string[] | null {
  if (state.kind === "end") return null;
  return state.hands.find((h) => h.playerId === peerId)?.cards ?? null;
}

/** Fill-in-the-blank formatter (also exposed to UI). */
export function fillBlank(prompt: string, answer: string): string {
  if (prompt.includes("___")) return prompt.replace("___", answer);
  return `${prompt} ${answer}`;
}

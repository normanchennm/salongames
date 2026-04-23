/** Fibbage remote-play state machine.
 *
 *  Differences from pass-and-play:
 *   - Everyone writes bluffs at the same time on their own screen.
 *   - Everyone votes at the same time on their own screen.
 *   - The host's reducer waits until all online players have submitted
 *     before advancing phase.
 *
 *  Keeping the full prompt list (including truths) in the shared state
 *  is fine — in a remote session, by the time players see the prompt
 *  list at all, they're already on the voting screen where truths are
 *  implicitly revealed anyway. We just don't surface prompt.truth in
 *  the bluff-writing UI. */

import { type FibPrompt, pickPrompts } from "./prompts";

export const FIB_ROUNDS = 5;

type Scores = Record<string, number>;

export interface Bluff {
  playerId: string;
  text: string;
}

export interface VoteOption {
  id: string;
  label: string;
  isTruth: boolean;
  authors: string[];
}

export type FibRemoteState =
  | {
      kind: "bluff";
      round: number;
      totalRounds: number;
      prompts: FibPrompt[];
      bluffs: Record<string, string>;
      scores: Scores;
    }
  | {
      kind: "vote";
      round: number;
      totalRounds: number;
      prompts: FibPrompt[];
      options: VoteOption[];
      votes: Record<string, string>;
      scores: Scores;
    }
  | {
      kind: "reveal";
      round: number;
      totalRounds: number;
      prompts: FibPrompt[];
      options: VoteOption[];
      votes: Record<string, string>;
      scores: Scores;
      delta: Scores;
    }
  | { kind: "end"; prompts: FibPrompt[]; scores: Scores };

export type FibRemoteAction =
  | { type: "submit-bluff"; text: string }
  | { type: "submit-vote"; optionId: string }
  | { type: "next-round" }
  | { type: "play-again" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

export function fibRemoteInitialState(players: Array<{ peerId: string; name: string }>): FibRemoteState {
  const prompts = pickPrompts(FIB_ROUNDS);
  const scores: Scores = {};
  for (const p of players) scores[p.peerId] = 0;
  return {
    kind: "bluff",
    round: 0,
    totalRounds: FIB_ROUNDS,
    prompts,
    bluffs: {},
    scores,
  };
}

function isTruthy(prompt: FibPrompt, text: string): boolean {
  const norm = text.trim().toLowerCase();
  if (!norm) return false;
  if (norm === prompt.truth.trim().toLowerCase()) return true;
  return (prompt.aliases ?? []).some((a) => a.trim().toLowerCase() === norm);
}

function normalizeBluff(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildOptions(prompt: FibPrompt, bluffs: Record<string, string>): VoteOption[] {
  const groups = new Map<string, { label: string; authors: string[] }>();
  for (const [playerId, text] of Object.entries(bluffs)) {
    const key = normalizeBluff(text);
    if (!key) continue;
    if (isTruthy(prompt, text)) continue; // truth collisions handled in scoring
    const prev = groups.get(key);
    if (prev) prev.authors.push(playerId);
    else groups.set(key, { label: text.trim(), authors: [playerId] });
  }
  const options: VoteOption[] = Array.from(groups.entries()).map(([key, g]) => ({
    id: `bluff:${key}`,
    label: g.label,
    isTruth: false,
    authors: g.authors,
  }));
  options.push({ id: "truth", label: prompt.truth, isTruth: true, authors: [] });
  // Shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

function scoreRound(
  prompt: FibPrompt,
  bluffs: Record<string, string>,
  options: VoteOption[],
  votes: Record<string, string>,
  activePlayers: string[],
): Scores {
  const delta: Scores = Object.fromEntries(activePlayers.map((id) => [id, 0]));
  const truthOption = options.find((o) => o.isTruth);
  for (const id of activePlayers) {
    const myBluff = bluffs[id];
    if (myBluff && isTruthy(prompt, myBluff)) {
      delta[id] += 1000;
      continue;
    }
    if (truthOption && votes[id] === truthOption.id) {
      delta[id] += 1000;
    }
  }
  for (const [voterId, pickedId] of Object.entries(votes)) {
    const picked = options.find((o) => o.id === pickedId);
    if (!picked || picked.isTruth) continue;
    for (const authorId of picked.authors) {
      if (authorId === voterId) continue;
      delta[authorId] = (delta[authorId] ?? 0) + 500;
    }
  }
  return delta;
}

function onlineIds(players: MinimalPlayer[]): string[] {
  return players.filter((p) => p.online).map((p) => p.peerId);
}

function hostId(players: MinimalPlayer[]): string | null {
  return players.find((p) => p.isHost)?.peerId ?? null;
}

/** Ensure the scores map has an entry for every player; zero-fill late joiners. */
function reconcileScores(scores: Scores, players: MinimalPlayer[]): Scores {
  let changed = false;
  const next: Scores = { ...scores };
  for (const p of players) {
    if (!(p.peerId in next)) {
      next[p.peerId] = 0;
      changed = true;
    }
  }
  return changed ? next : scores;
}

export function fibRemoteReducer(
  state: FibRemoteState,
  action: FibRemoteAction,
  senderPeerId: string,
  players: MinimalPlayer[],
): FibRemoteState {
  const sender = players.find((p) => p.peerId === senderPeerId);
  if (!sender) return state;

  // Keep scores reconciled with live roster so latecomers can see their line.
  if ("scores" in state) {
    const reconciled = reconcileScores(state.scores, players);
    if (reconciled !== state.scores) {
      state = { ...state, scores: reconciled } as FibRemoteState;
    }
  }

  if (action.type === "submit-bluff") {
    if (state.kind !== "bluff") return state;
    if (!sender.online) return state;
    const text = action.text.trim();
    if (!text) return state;
    if (state.bluffs[senderPeerId]) return state; // already submitted
    const nextBluffs = { ...state.bluffs, [senderPeerId]: text };
    const live = onlineIds(players);
    const allIn = live.every((id) => nextBluffs[id] !== undefined);
    if (!allIn) {
      return { ...state, bluffs: nextBluffs };
    }
    const prompt = state.prompts[state.round];
    const options = buildOptions(prompt, nextBluffs);
    return {
      kind: "vote",
      round: state.round,
      totalRounds: state.totalRounds,
      prompts: state.prompts,
      options,
      votes: {},
      scores: state.scores,
    };
  }

  if (action.type === "submit-vote") {
    if (state.kind !== "vote") return state;
    if (!sender.online) return state;
    if (state.votes[senderPeerId]) return state;
    const opt = state.options.find((o) => o.id === action.optionId);
    if (!opt) return state;
    if (opt.authors.includes(senderPeerId)) return state; // can't vote for your own
    const nextVotes = { ...state.votes, [senderPeerId]: action.optionId };
    const live = onlineIds(players);
    const allIn = live.every((id) => nextVotes[id] !== undefined);
    if (!allIn) {
      return { ...state, votes: nextVotes };
    }
    const prompt = state.prompts[state.round];
    // Reconstruct bluffs map from options.authors for scoring.
    const bluffs: Record<string, string> = {};
    for (const o of state.options) {
      if (o.isTruth) continue;
      for (const authorId of o.authors) bluffs[authorId] = o.label;
    }
    const delta = scoreRound(prompt, bluffs, state.options, nextVotes, live);
    const nextScores: Scores = { ...state.scores };
    for (const id of live) nextScores[id] = (nextScores[id] ?? 0) + (delta[id] ?? 0);
    return {
      kind: "reveal",
      round: state.round,
      totalRounds: state.totalRounds,
      prompts: state.prompts,
      options: state.options,
      votes: nextVotes,
      scores: nextScores,
      delta,
    };
  }

  if (action.type === "next-round") {
    if (senderPeerId !== hostId(players)) return state;
    if (state.kind !== "reveal") return state;
    const next = state.round + 1;
    if (next >= state.totalRounds) {
      return { kind: "end", prompts: state.prompts, scores: state.scores };
    }
    return {
      kind: "bluff",
      round: next,
      totalRounds: state.totalRounds,
      prompts: state.prompts,
      bluffs: {},
      scores: state.scores,
    };
  }

  if (action.type === "play-again") {
    if (senderPeerId !== hostId(players)) return state;
    if (state.kind !== "end") return state;
    const prompts = pickPrompts(FIB_ROUNDS);
    const scores: Scores = {};
    for (const p of players) scores[p.peerId] = 0;
    return {
      kind: "bluff",
      round: 0,
      totalRounds: FIB_ROUNDS,
      prompts,
      bluffs: {},
      scores,
    };
  }

  return state;
}

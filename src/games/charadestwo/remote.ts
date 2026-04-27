/** Charades for Two remote state. Actor sees the prompt on their
 *  device; guesser sees only the timer + score. Roles alternate
 *  per round. Host owns the timer (advances on tick); both players
 *  can dispatch got/skip. */

import { PROMPTS, pickFrom, type Prompt } from "./prompts";

const ROUND_SEC = 60;
const ROUNDS = 6;

export type CTRemoteState =
  | { kind: "intro" }
  | { kind: "pre"; round: number; actor: 0 | 1; scoreA: number; scoreB: number }
  | { kind: "show-prompt"; round: number; actor: 0 | 1; prompt: Prompt; seen: string[]; scoreA: number; scoreB: number }
  | {
      kind: "playing";
      round: number;
      actor: 0 | 1;
      prompt: Prompt;
      startedAt: number;
      durationMs: number;
      got: number;
      skipped: number;
      seen: string[];
      scoreA: number;
      scoreB: number;
    }
  | { kind: "round-end"; round: number; actor: 0 | 1; got: number; skipped: number; scoreA: number; scoreB: number; seen: string[] }
  | { kind: "end"; scoreA: number; scoreB: number };

export type CTRemoteAction =
  | { type: "begin" }
  | { type: "show-prompt" }
  | { type: "start-timer" }
  | { type: "got" }
  | { type: "skip" }
  | { type: "time-up" }
  | { type: "next-round" };

void PROMPTS; // ensure import used

export const ctRemoteInitialState: () => CTRemoteState = () => ({ kind: "intro" });

export function ctRemoteReducer(state: CTRemoteState, action: CTRemoteAction): CTRemoteState {
  if (action.type === "begin" && state.kind === "intro") {
    return { kind: "pre", round: 0, actor: 0, scoreA: 0, scoreB: 0 };
  }
  if (action.type === "show-prompt" && state.kind === "pre") {
    return {
      kind: "show-prompt",
      round: state.round,
      actor: state.actor,
      prompt: pickFrom(new Set()),
      seen: [],
      scoreA: state.scoreA,
      scoreB: state.scoreB,
    };
  }
  if (action.type === "start-timer" && state.kind === "show-prompt") {
    return {
      kind: "playing",
      round: state.round,
      actor: state.actor,
      prompt: state.prompt,
      startedAt: Date.now(),
      durationMs: ROUND_SEC * 1000,
      got: 0,
      skipped: 0,
      seen: [...state.seen, state.prompt.text],
      scoreA: state.scoreA,
      scoreB: state.scoreB,
    };
  }
  if ((action.type === "got" || action.type === "skip") && state.kind === "playing") {
    const seenSet = new Set([...state.seen, state.prompt.text]);
    const newPrompt = pickFrom(seenSet);
    return {
      ...state,
      prompt: newPrompt,
      got: state.got + (action.type === "got" ? 1 : 0),
      skipped: state.skipped + (action.type === "skip" ? 1 : 0),
      seen: [...seenSet, newPrompt.text],
    };
  }
  if (action.type === "time-up" && state.kind === "playing") {
    const scoreA = state.actor === 0 ? state.scoreA + state.got : state.scoreA;
    const scoreB = state.actor === 1 ? state.scoreB + state.got : state.scoreB;
    return {
      kind: "round-end",
      round: state.round,
      actor: state.actor,
      got: state.got,
      skipped: state.skipped,
      seen: state.seen,
      scoreA,
      scoreB,
    };
  }
  if (action.type === "next-round" && state.kind === "round-end") {
    const next = state.round + 1;
    const nextActor: 0 | 1 = state.actor === 0 ? 1 : 0;
    if (next >= ROUNDS) return { kind: "end", scoreA: state.scoreA, scoreB: state.scoreB };
    return { kind: "pre", round: next, actor: nextActor, scoreA: state.scoreA, scoreB: state.scoreB };
  }
  return state;
}

export const ROUND_LIMIT_SEC = ROUND_SEC;
export const TOTAL_ROUNDS = ROUNDS;

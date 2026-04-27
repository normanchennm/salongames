/** 36 Questions remote state. Both phones see the same question; any
 *  peer can advance. The host runs the reducer; joiners dispatch
 *  intents. Identical sequence to local — set 0/1/2, index 0..11,
 *  whoseTurn flips per question. */

import { SETS } from "./prompts";

export type ThirtySixRemoteState =
  | { kind: "intro" }
  | { kind: "set-intro"; set: number }
  | { kind: "playing"; set: number; index: number; whoseTurn: 0 | 1 }
  | { kind: "end" };

export type ThirtySixRemoteAction =
  | { type: "begin" }
  | { type: "begin-set" }
  | { type: "advance" };

export const thirtysixRemoteInitialState: () => ThirtySixRemoteState = () => ({ kind: "intro" });

export function thirtysixRemoteReducer(
  state: ThirtySixRemoteState,
  action: ThirtySixRemoteAction,
): ThirtySixRemoteState {
  if (action.type === "begin" && state.kind === "intro") {
    return { kind: "set-intro", set: 0 };
  }
  if (action.type === "begin-set" && state.kind === "set-intro") {
    return { kind: "playing", set: state.set, index: 0, whoseTurn: 0 };
  }
  if (action.type === "advance" && state.kind === "playing") {
    if (state.whoseTurn === 0) return { ...state, whoseTurn: 1 };
    const nextIdx = state.index + 1;
    if (nextIdx >= SETS[state.set].questions.length) {
      const nextSet = state.set + 1;
      if (nextSet >= SETS.length) return { kind: "end" };
      return { kind: "set-intro", set: nextSet };
    }
    return { ...state, index: nextIdx, whoseTurn: 0 };
  }
  return state;
}

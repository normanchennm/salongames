/** Compatibility Bingo remote state. Each player builds their grid
 *  privately on their own device. Toggles are dispatched and the
 *  reducer enforces the 9-tag limit. Once both grids are locked,
 *  reveal phase compares them. */

import { GRID_SIZE } from "./deck";

export type CBRemoteState =
  | { kind: "intro" }
  | { kind: "picking"; aTags: string[]; bTags: string[]; aLocked: boolean; bLocked: boolean }
  | { kind: "reveal"; aTags: string[]; bTags: string[] };

export type CBRemoteAction =
  | { type: "begin" }
  | { type: "toggle"; whose: 0 | 1; tag: string }
  | { type: "lock"; whose: 0 | 1 };

export const cbRemoteInitialState: () => CBRemoteState = () => ({ kind: "intro" });

export function cbRemoteReducer(state: CBRemoteState, action: CBRemoteAction): CBRemoteState {
  if (action.type === "begin" && state.kind === "intro") {
    return { kind: "picking", aTags: [], bTags: [], aLocked: false, bLocked: false };
  }
  if (action.type === "toggle" && state.kind === "picking") {
    const target = action.whose === 0 ? state.aTags : state.bTags;
    const lockedFlag = action.whose === 0 ? state.aLocked : state.bLocked;
    if (lockedFlag) return state;
    const idx = target.indexOf(action.tag);
    let next: string[];
    if (idx >= 0) next = target.filter((t) => t !== action.tag);
    else if (target.length < GRID_SIZE) next = [...target, action.tag];
    else return state; // 9 max
    return action.whose === 0
      ? { ...state, aTags: next }
      : { ...state, bTags: next };
  }
  if (action.type === "lock" && state.kind === "picking") {
    const tags = action.whose === 0 ? state.aTags : state.bTags;
    if (tags.length !== GRID_SIZE) return state;
    const aLocked = action.whose === 0 ? true : state.aLocked;
    const bLocked = action.whose === 1 ? true : state.bLocked;
    if (aLocked && bLocked) {
      return { kind: "reveal", aTags: state.aTags, bTags: state.bTags };
    }
    return { ...state, aLocked, bLocked };
  }
  return state;
}

/** Bucket List Bingo remote state. The host's localStorage keeps the
 *  archive; remote state holds only the current session — turn index,
 *  draft, whose turn — plus a count so joiners see how many are saved.
 *  Either player can dispatch (write the draft, submit, skip, end). */

import type { BLEntry } from "./Board";

export type BLRemoteState =
  | { kind: "intro"; archiveCount: number }
  | { kind: "adding"; turn: number; whose: 0 | 1; draft: string; addedThisSession: number; archiveCount: number; pendingArchive?: BLEntry }
  | { kind: "review"; addedThisSession: number; archiveCount: number };

export type BLRemoteAction =
  | { type: "begin" }
  | { type: "set-draft"; draft: string }
  | { type: "submit" }
  | { type: "skip" }
  | { type: "end" }
  | { type: "open-review" };

export const blRemoteInitialState = (archiveCount = 0): BLRemoteState => ({
  kind: "intro",
  archiveCount,
});

const TARGET_TURNS = 10;

import { categoryAt } from "./categories";

export function blRemoteReducer(
  state: BLRemoteState,
  action: BLRemoteAction,
  _senderPeerId: string,
  players: Array<{ peerId: string; name: string }>,
): BLRemoteState {
  if (action.type === "begin" && state.kind === "intro") {
    return {
      kind: "adding",
      turn: 0,
      whose: 0,
      draft: "",
      addedThisSession: 0,
      archiveCount: state.archiveCount,
    };
  }
  if (action.type === "set-draft" && state.kind === "adding") {
    return { ...state, draft: action.draft.slice(0, 200), pendingArchive: undefined };
  }
  if (action.type === "submit" && state.kind === "adding") {
    if (!state.draft.trim()) return state;
    const author = state.whose === 0 ? players[0] : players[1] ?? players[0];
    const entry: BLEntry = {
      ts: new Date().toISOString(),
      author: author?.name ?? "?",
      category: categoryAt(state.turn).id,
      text: state.draft.trim(),
    };
    const nextTurn = state.turn + 1;
    const nextAdded = state.addedThisSession + 1;
    const nextCount = state.archiveCount + 1;
    if (nextTurn >= TARGET_TURNS) {
      return {
        kind: "review",
        addedThisSession: nextAdded,
        archiveCount: nextCount,
      };
    }
    return {
      kind: "adding",
      turn: nextTurn,
      whose: state.whose === 0 ? 1 : 0,
      draft: "",
      addedThisSession: nextAdded,
      archiveCount: nextCount,
      // Surface this entry to the RemoteBoard for the host to persist.
      // Cleared on the next set-draft.
      pendingArchive: entry,
    };
  }
  if (action.type === "skip" && state.kind === "adding") {
    const nextTurn = state.turn + 1;
    if (nextTurn >= TARGET_TURNS) {
      return {
        kind: "review",
        addedThisSession: state.addedThisSession,
        archiveCount: state.archiveCount,
      };
    }
    return {
      kind: "adding",
      turn: nextTurn,
      whose: state.whose === 0 ? 1 : 0,
      draft: "",
      addedThisSession: state.addedThisSession,
      archiveCount: state.archiveCount,
    };
  }
  if (action.type === "end" && state.kind === "adding") {
    return {
      kind: "review",
      addedThisSession: state.addedThisSession,
      archiveCount: state.archiveCount,
    };
  }
  return state;
}

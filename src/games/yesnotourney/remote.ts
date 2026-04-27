/** Yes / No Tournament remote — alternating-rung ladder.
 *
 *  whose 0 = host, whose 1 = joiner. The active player's device shows
 *  the dare; the other shows a waiting screen. Reducer enforces that
 *  only the active device can YES/NO/reroll. */

import { RUNGS, TOTAL_RUNGS, pickDare } from "./rungs";

void RUNGS;

export type YNTRemoteState =
  | { kind: "intro" }
  | { kind: "pass"; rungIdx: number; whose: 0 | 1 }
  | { kind: "dare"; rungIdx: number; whose: 0 | 1; dare: string; rerolled: boolean }
  | { kind: "won"; loser: 0 | 1; rungCleared: number }
  | { kind: "summit"; rungCleared: number };

export type YNTRemoteAction =
  | { type: "begin" }
  | { type: "reveal" }
  | { type: "yes" }
  | { type: "no" }
  | { type: "reroll" }
  | { type: "play-again" };

interface MinimalPlayer {
  peerId: string;
  name: string;
  isHost: boolean;
  online: boolean;
}

export const yntRemoteInitialState: () => YNTRemoteState = () => ({ kind: "intro" });

function whoseFromSender(senderPeerId: string, players: MinimalPlayer[]): 0 | 1 | null {
  const sender = players.find((p) => p.peerId === senderPeerId);
  if (!sender) return null;
  return sender.isHost ? 0 : 1;
}

export function yntRemoteReducer(
  state: YNTRemoteState,
  action: YNTRemoteAction,
  senderPeerId: string,
  players: MinimalPlayer[],
): YNTRemoteState {
  const whose = whoseFromSender(senderPeerId, players);
  if (whose === null) return state;
  const isHost = whose === 0;

  if (action.type === "begin") {
    if (state.kind !== "intro") return state;
    if (!isHost) return state;
    return { kind: "pass", rungIdx: 0, whose: 0 };
  }

  if (action.type === "play-again") {
    if (state.kind !== "won" && state.kind !== "summit") return state;
    if (!isHost) return state;
    return { kind: "pass", rungIdx: 0, whose: 0 };
  }

  // From here on, only the active player can act.
  if (state.kind === "pass") {
    if (action.type !== "reveal") return state;
    if (whose !== state.whose) return state;
    return {
      kind: "dare",
      rungIdx: state.rungIdx,
      whose: state.whose,
      dare: pickDare(state.rungIdx),
      rerolled: false,
    };
  }

  if (state.kind === "dare") {
    if (whose !== state.whose) return state;

    if (action.type === "reroll") {
      if (state.rerolled) return state;
      return { ...state, dare: pickDare(state.rungIdx, state.dare), rerolled: true };
    }

    if (action.type === "yes") {
      const next = state.rungIdx + 1;
      if (next >= TOTAL_RUNGS) return { kind: "summit", rungCleared: TOTAL_RUNGS };
      return { kind: "pass", rungIdx: next, whose: state.whose === 0 ? 1 : 0 };
    }

    if (action.type === "no") {
      return { kind: "won", loser: state.whose, rungCleared: state.rungIdx };
    }
  }

  return state;
}

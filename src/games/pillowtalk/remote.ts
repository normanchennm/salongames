/** Pillow Talk remote — same semantics as local, just shared across
 *  two devices in bed. Either player can draw the next prompt; both
 *  see it simultaneously. No turn ordering, no roles. */

import { CLOSE, CLOSER, CLOSEST, type Tier } from "./prompts";

void CLOSE; void CLOSER; void CLOSEST;

export type PTalkRemoteState =
  | { kind: "intro" }
  | { kind: "open"; current: string; tier: Tier; seen: string[]; count: number }
  | { kind: "end"; count: number };

export type PTalkRemoteAction =
  | { type: "draw"; tier: Tier }
  | { type: "end-night" };

export const ptalkRemoteInitialState: () => PTalkRemoteState = () => ({ kind: "intro" });

function pickFrom(tier: Tier, seenSet: Set<string>): string {
  const deck = tier === "close" ? CLOSE : tier === "closer" ? CLOSER : CLOSEST;
  const remaining = deck.filter((q) => !seenSet.has(q));
  const pool = remaining.length > 0 ? remaining : deck;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function ptalkRemoteReducer(
  state: PTalkRemoteState,
  action: PTalkRemoteAction,
): PTalkRemoteState {
  if (action.type === "draw") {
    if (state.kind === "end") return state;
    const seen = state.kind === "open" ? state.seen : [];
    const count = state.kind === "open" ? state.count : 0;
    const q = pickFrom(action.tier, new Set(seen));
    return {
      kind: "open",
      current: q,
      tier: action.tier,
      seen: [...seen, q],
      count: count + 1,
    };
  }
  if (action.type === "end-night") {
    if (state.kind !== "open") return { kind: "end", count: 0 };
    return { kind: "end", count: state.count };
  }
  return state;
}

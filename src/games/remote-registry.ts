/** Client-only registry of remote-play state machines.
 *
 *  Each entry is a {initialState, reducer} pair keyed by game id.
 *  Kept separate from the main Game registry because these values
 *  contain functions that can't cross a React Server Component
 *  boundary — and the main registry IS imported by RSCs (the home
 *  page and /games/[id]/page.tsx both render game metadata server-
 *  side). */

import type { RemoteGameConfig } from "./types";
import { fibRemoteInitialState, fibRemoteReducer } from "./fibbage/remote";

export const REMOTE_CONFIGS: Record<string, RemoteGameConfig> = {
  fibbage: { initialState: fibRemoteInitialState, reducer: fibRemoteReducer as RemoteGameConfig["reducer"] },
};

export function getRemoteConfig(gameId: string): RemoteGameConfig | undefined {
  return REMOTE_CONFIGS[gameId];
}

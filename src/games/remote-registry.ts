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
import { tpRemoteInitialState, tpRemoteReducer } from "./telephonepic/remote";
import { cnRemoteInitialState, cnRemoteReducer } from "./codenames/remote";
import { baRemoteInitialState, baRemoteReducer } from "./badanswers/remote";
import { bsRemoteInitialState, bsRemoteReducer } from "./battleship/remote";
import { wwRemoteInitialState, wwRemoteReducerExtended } from "./werewolf/remote";
import { mafiaRemoteInitialState, mafiaRemoteReducer } from "./mafia/remote";
import { resistanceRemoteInitialState, resistanceRemoteReducer } from "./resistance/remote";
import { avalonRemoteInitialState, avalonRemoteReducer } from "./avalon/remote";

export const REMOTE_CONFIGS: Record<string, RemoteGameConfig> = {
  fibbage: { initialState: fibRemoteInitialState, reducer: fibRemoteReducer as RemoteGameConfig["reducer"] },
  telephonepic: { initialState: tpRemoteInitialState, reducer: tpRemoteReducer as RemoteGameConfig["reducer"] },
  codenames: { initialState: cnRemoteInitialState, reducer: cnRemoteReducer as RemoteGameConfig["reducer"] },
  badanswers: { initialState: baRemoteInitialState, reducer: baRemoteReducer as RemoteGameConfig["reducer"] },
  battleship: { initialState: bsRemoteInitialState, reducer: bsRemoteReducer as RemoteGameConfig["reducer"] },
  werewolf: { initialState: wwRemoteInitialState, reducer: wwRemoteReducerExtended as RemoteGameConfig["reducer"] },
  mafia: { initialState: mafiaRemoteInitialState, reducer: mafiaRemoteReducer as RemoteGameConfig["reducer"] },
  resistance: { initialState: resistanceRemoteInitialState, reducer: resistanceRemoteReducer as RemoteGameConfig["reducer"] },
  avalon: { initialState: avalonRemoteInitialState, reducer: avalonRemoteReducer as RemoteGameConfig["reducer"] },
};

export function getRemoteConfig(gameId: string): RemoteGameConfig | undefined {
  return REMOTE_CONFIGS[gameId];
}

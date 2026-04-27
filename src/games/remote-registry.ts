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
import { shRemoteInitialState, shRemoteReducer } from "./sh/remote";
import { insiderRemoteInitialState, insiderRemoteReducer } from "./insider/remote";
import { onRemoteInitialState, onRemoteReducer } from "./onenightww/remote";
import { heartsRemoteInitialState, heartsRemoteReducer } from "./hearts/remote";
import { spadesRemoteInitialState, spadesRemoteReducer } from "./spades/remote";
import { rummyRemoteInitialState, rummyRemoteReducer } from "./rummy/remote";
import { coupRemoteInitialState, coupRemoteReducer } from "./coup/remote";
import { tttRemoteInitialState, tttRemoteReducer } from "./tictactoe/remote";
import { c4RemoteInitialState, c4RemoteReducer } from "./connect4/remote";
import { reversiRemoteInitialState, reversiRemoteReducer } from "./reversi/remote";
import { mancalaRemoteInitialState, mancalaRemoteReducer } from "./mancala/remote";
import { checkersRemoteInitialState, checkersRemoteReducer } from "./checkers/remote";
import { dbRemoteInitialState, dbRemoteReducer } from "./dotsboxes/remote";
import { goRemoteInitialState, goRemoteReducer } from "./go/remote";
import { nmmRemoteInitialState, nmmRemoteReducer } from "./nmm/remote";
import { chessRemoteInitialState, chessRemoteReducer } from "./chess/remote";
import { bgRemoteInitialState, bgRemoteReducer } from "./backgammon/remote";
// --- Couple games ---
import { thirtysixRemoteInitialState, thirtysixRemoteReducer } from "./thirtysix/remote";
import { mjRemoteInitialState, mjRemoteReducer } from "./memoryjar/remote";
import { drRemoteInitialState, drRemoteReducer } from "./dateroulette/remote";
import { blRemoteInitialState, blRemoteReducer } from "./bucketlist/remote";
import { muRemoteInitialState, muRemoteReducer } from "./mapofus/remote";
import { llRemoteInitialState, llRemoteReducer } from "./lovelanguages/remote";
import { cbRemoteInitialState, cbRemoteReducer } from "./compatbingo/remote";
import { hssRemoteInitialState, hssRemoteReducer } from "./hesaidshesaid/remote";
import { nwRemoteInitialState, nwRemoteReducer } from "./newlywed/remote";
import { ctRemoteInitialState, ctRemoteReducer } from "./charadestwo/remote";
import { tptRemoteInitialState, tptRemoteReducer } from "./telephonepictwo/remote";
import { ptalkRemoteInitialState, ptalkRemoteReducer } from "./pillowtalk/remote";
import { yntRemoteInitialState, yntRemoteReducer } from "./yesnotourney/remote";

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
  sh: { initialState: shRemoteInitialState, reducer: shRemoteReducer as RemoteGameConfig["reducer"] },
  insider: { initialState: insiderRemoteInitialState, reducer: insiderRemoteReducer as RemoteGameConfig["reducer"] },
  onenightww: { initialState: onRemoteInitialState, reducer: onRemoteReducer as RemoteGameConfig["reducer"] },
  hearts: { initialState: heartsRemoteInitialState, reducer: heartsRemoteReducer as RemoteGameConfig["reducer"] },
  spades: { initialState: spadesRemoteInitialState, reducer: spadesRemoteReducer as RemoteGameConfig["reducer"] },
  rummy: { initialState: rummyRemoteInitialState, reducer: rummyRemoteReducer as RemoteGameConfig["reducer"] },
  coup: { initialState: coupRemoteInitialState, reducer: coupRemoteReducer as RemoteGameConfig["reducer"] },
  tictactoe: { initialState: tttRemoteInitialState, reducer: tttRemoteReducer as RemoteGameConfig["reducer"] },
  connect4: { initialState: c4RemoteInitialState, reducer: c4RemoteReducer as RemoteGameConfig["reducer"] },
  reversi: { initialState: reversiRemoteInitialState, reducer: reversiRemoteReducer as RemoteGameConfig["reducer"] },
  mancala: { initialState: mancalaRemoteInitialState, reducer: mancalaRemoteReducer as RemoteGameConfig["reducer"] },
  checkers: { initialState: checkersRemoteInitialState, reducer: checkersRemoteReducer as RemoteGameConfig["reducer"] },
  dotsboxes: { initialState: dbRemoteInitialState, reducer: dbRemoteReducer as RemoteGameConfig["reducer"] },
  go: { initialState: goRemoteInitialState, reducer: goRemoteReducer as RemoteGameConfig["reducer"] },
  nmm: { initialState: nmmRemoteInitialState, reducer: nmmRemoteReducer as RemoteGameConfig["reducer"] },
  chess: { initialState: chessRemoteInitialState, reducer: chessRemoteReducer as RemoteGameConfig["reducer"] },
  backgammon: { initialState: bgRemoteInitialState, reducer: bgRemoteReducer as RemoteGameConfig["reducer"] },
  // --- Couple games ---
  thirtysix: { initialState: thirtysixRemoteInitialState, reducer: thirtysixRemoteReducer as RemoteGameConfig["reducer"] },
  memoryjar: { initialState: () => mjRemoteInitialState(0), reducer: mjRemoteReducer as RemoteGameConfig["reducer"] },
  dateroulette: { initialState: drRemoteInitialState, reducer: drRemoteReducer as RemoteGameConfig["reducer"] },
  bucketlist: { initialState: () => blRemoteInitialState(0), reducer: blRemoteReducer as RemoteGameConfig["reducer"] },
  mapofus: { initialState: () => muRemoteInitialState(0), reducer: muRemoteReducer as RemoteGameConfig["reducer"] },
  lovelanguages: { initialState: llRemoteInitialState, reducer: llRemoteReducer as RemoteGameConfig["reducer"] },
  compatbingo: { initialState: cbRemoteInitialState, reducer: cbRemoteReducer as RemoteGameConfig["reducer"] },
  hesaidshesaid: { initialState: hssRemoteInitialState, reducer: hssRemoteReducer as RemoteGameConfig["reducer"] },
  newlywed: { initialState: nwRemoteInitialState, reducer: nwRemoteReducer as RemoteGameConfig["reducer"] },
  charadestwo: { initialState: ctRemoteInitialState, reducer: ctRemoteReducer as RemoteGameConfig["reducer"] },
  telephonepictwo: { initialState: tptRemoteInitialState, reducer: tptRemoteReducer as RemoteGameConfig["reducer"] },
  pillowtalk: { initialState: ptalkRemoteInitialState, reducer: ptalkRemoteReducer as RemoteGameConfig["reducer"] },
  yesnotourney: { initialState: yntRemoteInitialState, reducer: yntRemoteReducer as RemoteGameConfig["reducer"] },
};

export function getRemoteConfig(gameId: string): RemoteGameConfig | undefined {
  return REMOTE_CONFIGS[gameId];
}

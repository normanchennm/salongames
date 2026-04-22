/** Central game registry. When we add a new game, we add it here and
 *  the catalog + /games/[id] route pick it up automatically. Order in
 *  this list is the display order on the catalog. */

import type { Game } from "./types";
import werewolf from "./werewolf";
import mafia from "./mafia";
import spyfall from "./spyfall";
import avalon from "./avalon";
import charades from "./charades";
import celebrity from "./celebrity";
import trivia from "./trivia";
import twotruths from "./twotruths";
import neverhaveiever from "./neverhaveiever";
import wouldyourather from "./wouldyourather";
import notstrangers from "./notstrangers";
import fibbage from "./fibbage";
import badanswers from "./badanswers";
import telephonepic from "./telephonepic";

export const GAMES: Game[] = [
  werewolf,
  mafia,
  spyfall,
  avalon,
  celebrity,
  trivia,
  fibbage,
  badanswers,
  telephonepic,
  charades,
  twotruths,
  neverhaveiever,
  wouldyourather,
  notstrangers,
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

/** Central game registry. When we add a new game, we add it here and
 *  the catalog + /games/[id] route pick it up automatically. Order in
 *  this list is the display order on the catalog. */

import type { Game } from "./types";
import werewolf from "./werewolf";
import mafia from "./mafia";
import spyfall from "./spyfall";
import charades from "./charades";
import trivia from "./trivia";
import twotruths from "./twotruths";
import neverhaveiever from "./neverhaveiever";

export const GAMES: Game[] = [
  werewolf,
  mafia,
  spyfall,
  trivia,
  charades,
  twotruths,
  neverhaveiever,
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

/** Central game registry. When we add a new game, we add it here and
 *  the catalog + /games/[id] route pick it up automatically. Order in
 *  this list is the display order on the catalog. */

import type { Game } from "./types";
import werewolf from "./werewolf";
import spyfall from "./spyfall";
import charades from "./charades";
import neverhaveiever from "./neverhaveiever";
import twotruths from "./twotruths";

export const GAMES: Game[] = [
  werewolf,
  spyfall,
  charades,
  twotruths,
  neverhaveiever,
  // Coming soon: mafia, trivia
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

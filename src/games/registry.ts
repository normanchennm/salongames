/** Central game registry. When we add a new game, we add it here and
 *  the catalog + /games/[id] route pick it up automatically. Order in
 *  this list is the display order on the catalog. */

import type { Game } from "./types";
import werewolf from "./werewolf";

export const GAMES: Game[] = [
  werewolf,
  // Coming soon:
  // mafia, spyfall, charades, trivia, twotruths, neverhaveiever
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

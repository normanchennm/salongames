import type { Game } from "@/games/types";
import { OneNightWWBoard } from "./Board";

const onenightww: Game = {
  id: "onenightww",
  name: "One Night Werewolf",
  tagline: "No elimination. One night. One vote.",
  category: "social-deduction",
  minPlayers: 4,
  maxPlayers: 8,
  estimatedMinutes: 10,
  tier: "free",
  coverGradient: ["#2a1a1a", "#100d0b"],
  description:
    "Roles are dealt with 3 cards left in the middle. Werewolves wake and see each other. Seer peeks. Robber swaps. Troublemaker scrambles. Morning: discuss, then a single vote. Kill a werewolf and the village wins — miss and they win. Very fast, very twisty.",
  Component: OneNightWWBoard,
};

export default onenightww;

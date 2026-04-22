import type { Game } from "@/games/types";
import { NineMensMorrisBoard } from "./Board";

const nmm: Game = {
  id: "nmm",
  name: "Nine Men's Morris",
  tagline: "Three concentric squares. Make mills. Capture.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#2a1a2a", "#100d0b"],
  description:
    "An ancient 2-player strategy game. Three phases: place 9 pieces, then slide along lines, then fly (when down to 3). Forming 3 in a row on a line captures an enemy piece — preferring those not already in mills. Reduce the opponent below 3 pieces or leave them without a move.",
  Component: NineMensMorrisBoard,
};

export default nmm;

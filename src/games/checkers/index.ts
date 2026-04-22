import type { Game } from "@/games/types";
import { CheckersBoard } from "./Board";

const checkers: Game = {
  id: "checkers",
  name: "Checkers",
  tagline: "Diagonal moves. Jumps capture. First to clear wins.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#2a1a10", "#100d0b"],
  description:
    "American-style checkers on an 8×8 board. Move one square diagonally forward. Jumping an enemy captures it; chain jumps are mandatory to finish. Reach the far row and the piece is crowned to move backward too. Jumps are optional in this ruleset. Capture every enemy or leave them with no legal move.",
  Component: CheckersBoard,
};

export default checkers;

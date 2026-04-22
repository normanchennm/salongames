import type { Game } from "@/games/types";
import { CharadesBoard } from "./Board";

const charades: Game = {
  id: "charades",
  name: "Charades",
  tagline: "Act it out. No talking. 60 seconds per round.",
  category: "party",
  minPlayers: 3,
  maxPlayers: 12,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#6b3d1f", "#100d0b"],
  description:
    "Rotating actor, 60-second timer, the table shouts guesses. Tap when they nail it, skip if they're stuck. Highest score after everyone's had a turn wins. Movies, animals, idioms, actions — pulls from a mixed prompt pack.",
  Component: CharadesBoard,
};

export default charades;

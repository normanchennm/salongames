import type { Game } from "@/games/types";
import { CelebrityBoard } from "./Board";

const celebrity: Game = {
  id: "celebrity",
  name: "Celebrity",
  tagline: "Everyone adds names. Three rounds. Describe, one word, charades.",
  category: "party",
  minPlayers: 4,
  maxPlayers: 12,
  estimatedMinutes: 30,
  tier: "free",
  coverGradient: ["#3d2a1a", "#100d0b"],
  description:
    "Everyone secretly types three names into the hat. Then three rounds with escalating difficulty on the same names: full sentences, single words, silent charades. Rotating actor, 60-second turns. Score by names guessed.",
  Component: CelebrityBoard,
};

export default celebrity;

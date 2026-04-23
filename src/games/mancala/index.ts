import type { Game } from "@/games/types";
import { MancalaBoard } from "./Board";

const mancala: Game = {
  id: "mancala",
  name: "Mancala",
  tagline: "Sow seeds. Capture. Most stones wins.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 10,
  tier: "free",
  coverGradient: ["#2a1a08", "#100d0b"],
  description:
    "Two rows of six pits, two stores, four stones in each starting pit. Pick up a pit's stones and sow one per pit counter-clockwise, passing your store and skipping the opponent's. Last stone in your store = another turn. Last stone in your empty pit captures the opposite pit's stones. Row empty ends the game; most stones wins.",
  Component: MancalaBoard,
  supportsRemote: true,
};

export default mancala;

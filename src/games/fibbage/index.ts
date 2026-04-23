import type { Game } from "@/games/types";
import { FibbageBoard } from "./Board";

const fibbage: Game = {
  id: "fibbage",
  name: "Fibbage",
  tagline: "Weird-but-true trivia. Bluff your answer. Spot the truth.",
  category: "party",
  minPlayers: 3,
  maxPlayers: 8,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#4a2a10", "#100d0b"],
  description:
    "Each round, the table sees one real trivia question with an answer so weird it sounds fake. Everyone privately writes a bluff. Then bluffs and truth are shuffled and each player votes which is real. +1000 for picking the truth, +500 per player you fool. 5 rounds.",
  Component: FibbageBoard,
  supportsRemote: true,
};

export default fibbage;

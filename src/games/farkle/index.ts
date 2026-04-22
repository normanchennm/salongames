import type { Game } from "@/games/types";
import { FarkleBoard } from "./Board";

const farkle: Game = {
  id: "farkle",
  name: "Farkle",
  tagline: "Hot dice and bad decisions. First to 10,000.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#2a2010", "#100d0b"],
  description:
    "Roll six dice. Tap the scoring ones to keep. Roll the rest, push your luck. 1s are 100, 5s are 50, three-of-a-kind scales, plus straight and three-pairs. A roll with no scoring dice wipes your turn. First to 10,000; every other player gets one final turn.",
  Component: FarkleBoard,
};

export default farkle;

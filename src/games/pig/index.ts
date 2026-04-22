import type { Game } from "@/games/types";
import { PigBoard } from "./Board";

const pig: Game = {
  id: "pig",
  name: "Pig",
  tagline: "Roll. Hold. Or bust on a 1.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 10,
  tier: "free",
  coverGradient: ["#3a2a2a", "#100d0b"],
  description:
    "The purest push-your-luck dice game. Roll one die, bank the pips, keep rolling at your own risk. A 1 wipes the turn. Hold to bank. First to 100 wins.",
  Component: PigBoard,
};

export default pig;

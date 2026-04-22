import type { Game } from "@/games/types";
import { BackgammonBoard } from "./Board";

const backgammon: Game = {
  id: "backgammon",
  name: "Backgammon",
  tagline: "Roll the dice. Bear off first.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 30,
  tier: "free",
  coverGradient: ["#2a1a10", "#100d0b"],
  description:
    "Standard 24-point starting position, 15 checkers each. Roll two dice, move two checkers (or one checker twice); doubles give four moves. Hit a lone opponent to send them to the bar — re-entry required before anything else. All home-board checkers in means you may bear off. First to bear off 15 wins. Doubling cube and match play deferred.",
  Component: BackgammonBoard,
};

export default backgammon;

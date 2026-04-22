import type { Game } from "@/games/types";
import { YahtzeeBoard } from "./Board";

const yahtzee: Game = {
  id: "yahtzee",
  name: "Yahtzy",
  tagline: "Five dice, three rolls, thirteen boxes.",
  category: "abstract",
  minPlayers: 1,
  maxPlayers: 4,
  estimatedMinutes: 25,
  tier: "free",
  coverGradient: ["#1a2a2a", "#100d0b"],
  description:
    "Roll five dice up to three times per turn; hold any between rolls. Each turn you must fill one of thirteen scoring boxes — ones through sixes, three/four-of-a-kind, full house, straights, five-of-a-kind (50), chance. Upper section earns a 35 bonus at 63. Highest total wins after 13 turns.",
  Component: YahtzeeBoard,
};

export default yahtzee;

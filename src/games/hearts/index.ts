import type { Game } from "@/games/types";
import { HeartsBoard } from "./Board";

const hearts: Game = {
  id: "hearts",
  name: "Hearts",
  tagline: "Avoid the hearts. Duck the Queen.",
  category: "card",
  minPlayers: 4,
  maxPlayers: 4,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#3a1020", "#100d0b"],
  description:
    "4-player classic trick-taking. Follow the led suit if you can. Hearts score 1 each and the Queen of Spades is 13; lowest total wins the hand. No hearts on trick 1. Hearts can only lead once broken. Shoot the moon (take all 26) and the others score instead of you. No passing phase or matching to 100 in this build.",
  Component: HeartsBoard,
};

export default hearts;

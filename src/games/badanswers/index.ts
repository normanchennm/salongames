import type { Game } from "@/games/types";
import { BadAnswersBoard } from "./Board";

const badanswers: Game = {
  id: "badanswers",
  name: "Cards Against Humans",
  tagline: "Fill-in-the-blanks. Your friends judge. The worst wins.",
  category: "card",
  minPlayers: 3,
  maxPlayers: 8,
  estimatedMinutes: 30,
  tier: "free",
  coverGradient: ["#1a1012", "#100d0b"],
  description:
    "One prompt per round. Every non-judge player privately plays a response card from their 7-card hand. Judge reads them anonymized, picks the best one. First to 5 points wins. Original card pack — edgy, not cruel.",
  Component: BadAnswersBoard,
};

export default badanswers;

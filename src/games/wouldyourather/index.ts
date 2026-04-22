import type { Game } from "@/games/types";
import { WouldYouRatherBoard } from "./Board";

const wouldyourather: Game = {
  id: "wouldyourather",
  name: "Would You Rather",
  tagline: "Two impossible choices. Defend yours. Next card.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 20,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#3e2a52", "#100d0b"],
  description:
    "A shuffled deck of 60 impossible dilemmas — light, absurd, philosophical. Reveal the card, everyone argues for their pick, next card. Open-ended — the game is the conversation.",
  Component: WouldYouRatherBoard,
};

export default wouldyourather;

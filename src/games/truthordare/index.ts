import type { Game } from "@/games/types";
import { TruthOrDareBoard } from "./Board";

const truthordare: Game = {
  id: "truthordare",
  name: "Truth or Dare",
  tagline: "Rotating turns. Choose one. Can't take it back.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 25,
  tier: "free",
  coverGradient: ["#3a1a2a", "#100d0b"],
  description:
    "The classic, for adults. On your turn you pick truth or dare and the phone serves a prompt. 30 truths and 30 dares across three intensity tiers — mild first-date energy at the top, third-date honesty in the middle, and genuinely intimate at the bottom. Re-roll a prompt if one hits wrong. Adults-only; unlocks in Dating Mode.",
  Component: TruthOrDareBoard,
  adultOnly: true,
};

export default truthordare;

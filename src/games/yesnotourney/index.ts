import type { Game } from "@/games/types";
import { ComingSoonBoard } from "@/games/_shared/ComingSoonBoard";

const yesnotourney: Game = {
  id: "yesnotourney",
  name: "Yes / No Tournament",
  tagline: "Escalating dares. Single elimination. Last refusal loses.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 20,
  tier: "pro",
  coverGradient: ["#4a3a2a", "#100d0b"],
  description:
    "A single-elimination ladder of yes/no dares that escalate in stakes — silly at the bottom, intimate at the top. First refusal at any rung loses the round. The only rule the app enforces: you can quit at any point with no penalty, and the score gets locked in. Adult dares unlock with the age gate.",
  Component: ComingSoonBoard,
  comingSoon: true,
  adultOnly: true,
};

export default yesnotourney;

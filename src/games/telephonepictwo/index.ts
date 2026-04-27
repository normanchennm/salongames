import type { Game } from "@/games/types";
import { ComingSoonBoard } from "@/games/_shared/ComingSoonBoard";

const telephonepictwo: Game = {
  id: "telephonepictwo",
  name: "Telephone Pictionary for Two",
  tagline: "Four alternating rounds. Caption → draw → caption → draw.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 10,
  tier: "free",
  coverGradient: ["#3a4a2a", "#100d0b"],
  description:
    "A mini version of Telephone Pictionary tuned for two — four alternating rounds (caption, draw, caption, draw) starting from a private prompt. The end-screen is a tiny artifact of the night. Great for the third date, great as a gift screenshot, great if you and your partner think differently and want to see it.",
  Component: ComingSoonBoard,
  comingSoon: true,
};

export default telephonepictwo;

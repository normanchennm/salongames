import type { Game } from "@/games/types";
import { ComingSoonBoard } from "@/games/_shared/ComingSoonBoard";

const charadestwo: Game = {
  id: "charadestwo",
  name: "Charades for Two",
  tagline: "Actor and guesser. Inside-joke deck instead of celebrities.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#4a3a2a", "#100d0b"],
  description:
    "Standard charades, but the deck is curated for two people who know each other — relationship in-jokes, things you've both said in earshot of friends, cinematic moments from your shared past. You'll explain a lot to the camera if you film it. That's the point.",
  Component: ComingSoonBoard,
  comingSoon: true,
};

export default charadestwo;

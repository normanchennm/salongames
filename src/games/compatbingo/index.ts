import type { Game } from "@/games/types";
import { ComingSoonBoard } from "@/games/_shared/ComingSoonBoard";

const compatbingo: Game = {
  id: "compatbingo",
  name: "Compatibility Bingo",
  tagline: "Fill a 3×3 grid of preferences. Reveal side by side.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#3a2a4a", "#100d0b"],
  description:
    "Each of you fills a private 3×3 grid by drawing from a deck of preference cards — sleeps in / hates spice / loves cats / fights with the AC. Reveal both grids side by side; count overlaps. Less a quiz, more a map: where do you actually agree, and where have you been quietly compromising?",
  Component: ComingSoonBoard,
  comingSoon: true,
};

export default compatbingo;

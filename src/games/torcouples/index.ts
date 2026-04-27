import type { Game } from "@/games/types";
import { ComingSoonBoard } from "@/games/_shared/ComingSoonBoard";

const torcouples: Game = {
  id: "torcouples",
  name: "Truth or Dare: Couples Edition",
  tagline: "Adult-tone prompts. Opt-in age gate. For two only.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 30,
  tier: "pro",
  coverGradient: ["#4a2a2a", "#100d0b"],
  description:
    "Truth or Dare written for couples, not for college parties. Three escalating decks — flirty, intimate, vulnerable — with an honest age gate at the door. Dares assume you're together. Truths assume you trust each other. Both assume you're choosing to do this on purpose.",
  Component: ComingSoonBoard,
  comingSoon: true,
  adultOnly: true,
};

export default torcouples;

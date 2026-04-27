import type { Game } from "@/games/types";
import { ComingSoonBoard } from "@/games/_shared/ComingSoonBoard";

const newlywed: Game = {
  id: "newlywed",
  name: "The Newlywed Game",
  tagline: "Three rounds. Predict your partner. Score who knows who better.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 25,
  tier: "free",
  coverGradient: ["#4a3a2a", "#100d0b"],
  description:
    "Three escalating rounds — easy (favorite food), medium (most embarrassing memory), spicy (red flags noticed). Each writes a private answer; partner predicts what they wrote. The score doesn't matter as much as the conversations the gaps start. Same engine pattern as Fibbage, but flipped: you're not bluffing strangers, you're trying to read each other.",
  Component: ComingSoonBoard,
  comingSoon: true,
};

export default newlywed;

import type { Game } from "@/games/types";
import { InsiderBoard } from "./Board";

const insider: Game = {
  id: "insider",
  name: "Insider",
  tagline: "One knows the word. One secretly helps. Find them out.",
  category: "social-deduction",
  minPlayers: 4,
  maxPlayers: 8,
  estimatedMinutes: 10,
  tier: "free",
  coverGradient: ["#2a1a4a", "#100d0b"],
  description:
    "The Master knows a secret word and answers yes/no only. Among the guessers, a hidden Insider also knows the word — their job is to steer without being caught. Guess in 4 minutes, then hunt the Insider in 2. Three possible winners. In Remote mode, Master + Insider see the word privately on their own devices.",
  Component: InsiderBoard,
  supportsRemote: true,
};

export default insider;

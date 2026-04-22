import type { Game } from "@/games/types";
import { MastermindBoard } from "./Board";

const mastermind: Game = {
  id: "mastermind",
  name: "Mastermind",
  tagline: "Crack the 4-color code in 10 tries.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: 10,
  tier: "free",
  coverGradient: ["#3a2a0a", "#100d0b"],
  description:
    "One player sets a secret 4-peg code from 6 colors (repeats allowed). The rest of the table has 10 guesses to crack it. Feedback after each guess: black peg = right color in the right slot; white peg = right color, wrong slot. Solve it and the guessers win.",
  Component: MastermindBoard,
};

export default mastermind;

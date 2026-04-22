import type { Game } from "@/games/types";
import { HangmanBoard } from "./Board";

const hangman: Game = {
  id: "hangman",
  name: "Hangman",
  tagline: "One picks the word. Everyone else has six wrong guesses.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 5,
  tier: "free",
  coverGradient: ["#1a2a3a", "#100d0b"],
  description:
    "Pass the phone: one player privately enters a word or phrase. Everyone else guesses letters together on a shared screen. Six wrong guesses and the gallows is drawn. Fill in the blanks first and the guessers win.",
  Component: HangmanBoard,
};

export default hangman;

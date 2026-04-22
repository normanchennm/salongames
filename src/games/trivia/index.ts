import type { Game } from "@/games/types";
import { TriviaBoard } from "./Board";

const trivia: Game = {
  id: "trivia",
  name: "Trivia",
  tagline: "10 questions. Rotating reader. Fastest yeller wins.",
  category: "trivia",
  minPlayers: 3,
  maxPlayers: 12,
  estimatedMinutes: 12,
  tier: "free",
  coverGradient: ["#3a2858", "#100d0b"],
  description:
    "A rotating player reads each question out loud, the table shouts guesses, the reader taps whoever yelled it first. 10 mixed-difficulty questions per game across history / science / geography / pop culture / sports.",
  Component: TriviaBoard,
};

export default trivia;

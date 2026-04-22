import type { Game } from "@/games/types";
import { NeverHaveIEverBoard } from "./Board";

const neverhaveiever: Game = {
  id: "neverhaveiever",
  name: "Never Have I Ever",
  tagline: "Prompt cards that reveal who's done what.",
  category: "party",
  minPlayers: 3,
  maxPlayers: 20,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#4a2a5c", "#100d0b"],
  description:
    "A shuffled deck of 'Never have I ever…' prompts. Reveal the card, people who HAVE done it drink / own it / tell the story. Open-ended — play as long as the stories keep coming. 50 mixed-intensity prompts in the free pack.",
  Component: NeverHaveIEverBoard,
};

export default neverhaveiever;

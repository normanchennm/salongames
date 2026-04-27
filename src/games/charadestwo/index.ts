import type { Game } from "@/games/types";
import { CharadesTwoBoard } from "./Board";

const charadestwo: Game = {
  id: "charadestwo",
  name: "Charades for Two",
  tagline: "Actor and guesser. Couples-flavored deck — no celebrities.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 15,
  tier: "free",
  coverGradient: ["#4a3a2a", "#100d0b"],
  description:
    "Standard charades, but the deck is curated for two — relationship-flavored prompts (loading the dishwasher 'wrong', sneaking into bed late, the moment you realize you forgot the anniversary). 6 rounds, 60 seconds each, alternating actor. In remote mode the guesser only sees the timer; the actor's prompt stays on the actor's phone.",
  Component: CharadesTwoBoard,
  supportsRemote: true,
};

export default charadestwo;

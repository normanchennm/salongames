import type { Game } from "@/games/types";
import { SpadesBoard } from "./Board";

const spades: Game = {
  id: "spades",
  name: "Spades",
  tagline: "Partnership bidding. Trump is always ♠.",
  category: "card",
  minPlayers: 4,
  maxPlayers: 4,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#1a1a30", "#100d0b"],
  description:
    "4-player trick-taking with fixed partnerships (seats 1+3 vs 2+4). Bid 0-13 tricks privately, then play 13 tricks. Spades trump; can't lead spades until one's been played. Partnership makes its bid → +10 per bid + 1 per overtrick; misses it → -10 per bid. Higher score wins. Single hand; Nil and matching-to-500 are deferred. In Remote mode, each hand stays private on its device and bidding is simultaneous.",
  Component: SpadesBoard,
  supportsRemote: true,
  hideLocalOption: true,
};

export default spades;

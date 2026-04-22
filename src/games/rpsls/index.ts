import type { Game } from "@/games/types";
import { RPSLSBoard } from "./Board";

const rpsls: Game = {
  id: "rpsls",
  name: "Rock Paper Scissors Lizard Spock",
  tagline: "Five throws, ten rules, best of five.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 3,
  tier: "free",
  coverGradient: ["#3a1a3a", "#100d0b"],
  description:
    "The Sheldon Cooper extension of RPS. Scissors cuts Paper. Paper covers Rock. Rock crushes Lizard. Lizard poisons Spock. Spock smashes Scissors. Scissors decapitates Lizard. Lizard eats Paper. Paper disproves Spock. Spock vaporizes Rock. Rock crushes Scissors. Pass the phone, pick privately, reveal simultaneously. Best of 5.",
  Component: RPSLSBoard,
};

export default rpsls;

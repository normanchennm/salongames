import type { Game } from "@/games/types";
import { ComingSoonBoard } from "@/games/_shared/ComingSoonBoard";

const bucketlist: Game = {
  id: "bucketlist",
  name: "Bucket List Bingo",
  tagline: "Co-author your goals. Travel, food, milestones. Take turns.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#2a4a4a", "#100d0b"],
  description:
    "You take turns adding entries to a shared bucket list — places to go, dishes to learn, milestones to hit, things to outgrow. The end-screen produces an editorial, printable list you can actually revisit. Built around the idea that the planning IS the romance.",
  Component: ComingSoonBoard,
  comingSoon: true,
};

export default bucketlist;

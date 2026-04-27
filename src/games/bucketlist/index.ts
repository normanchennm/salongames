import type { Game } from "@/games/types";
import { BucketListBoard } from "./Board";

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
    "You take turns adding entries to a shared bucket list — places to go, dishes to learn, milestones to hit, things to outgrow. The app suggests a category each turn (small / soon / travel / stretch / etc.) so the list has texture. End-screen produces an editorial, by-category readout you can revisit. Built around the idea that the planning IS the romance.",
  Component: BucketListBoard,
  supportsRemote: true,
};

export default bucketlist;

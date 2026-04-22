import type { Game } from "@/games/types";
import { SecretHitlerBoard } from "./Board";

const sh: Game = {
  id: "sh",
  name: "Secret Chancellor",
  tagline: "Policy drafts, elections, and one very secret identity.",
  category: "social-deduction",
  minPlayers: 5,
  maxPlayers: 10,
  estimatedMinutes: 35,
  tier: "free",
  coverGradient: ["#1a1a2a", "#100d0b"],
  description:
    "Secret Hitler-style. Roles dealt: Liberals, Fascists, one Hitler. Each round the President nominates a Chancellor; table votes ja/nein. On approval, President drafts 3 policies and passes 2 to the Chancellor who enacts one. Liberals win at 5 liberal policies or (not in this build) if Hitler is executed. Fascists win at 6 fascist policies, or if Hitler is elected Chancellor after 3 fascist policies pass. Executive powers (investigate, peek, execute) are deferred.",
  Component: SecretHitlerBoard,
};

export default sh;

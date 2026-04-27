import type { Game } from "@/games/types";
import { ThirtySixBoard } from "./Board";

const thirtysix: Game = {
  id: "thirtysix",
  name: "36 Questions",
  tagline: "The Aron sequence — three sets, deeper each time. For two.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 45,
  tier: "free",
  coverGradient: ["#3a2a4a", "#100d0b"],
  description:
    "Arthur Aron's research-backed deepening sequence — 36 questions in three escalating sets, designed to accelerate closeness between two people. No scoring, no tricks. Pass the phone, answer fully, take the next when you're both ready. The original viral 'love test' that actually works.",
  Component: ThirtySixBoard,
  supportsRemote: true,
};

export default thirtysix;

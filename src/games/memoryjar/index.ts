import type { Game } from "@/games/types";
import { ComingSoonBoard } from "@/games/_shared/ComingSoonBoard";

const memoryjar: Game = {
  id: "memoryjar",
  name: "Memory Jar",
  tagline: "Alternating prompts. Your shared memories, on rotation.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 25,
  tier: "free",
  coverGradient: ["#4a3a2a", "#100d0b"],
  description:
    "Alternating prompts that pull from your shared past — the worst meal you've eaten together, the moment you realized this might work, the small thing they did that you'll never forget. No scoring; the app quietly archives what you say so you can come back to the jar months later and read what you wrote.",
  Component: ComingSoonBoard,
  comingSoon: true,
};

export default memoryjar;

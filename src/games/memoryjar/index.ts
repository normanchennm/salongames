import type { Game } from "@/games/types";
import { MemoryJarBoard } from "./Board";

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
    "Alternating prompts that pull from your shared past — the worst meal you've eaten together, the moment you realized this might work, the small thing they did that you'll never forget. Optional one-line note per prompt; the app archives everything you save so you can come back to the jar months later and read what you wrote.",
  Component: MemoryJarBoard,
  supportsRemote: true,
};

export default memoryjar;

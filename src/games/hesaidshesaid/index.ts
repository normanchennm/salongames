import type { Game } from "@/games/types";
import { HesaidshesaidBoard } from "./Board";

const hesaidshesaid: Game = {
  id: "hesaidshesaid",
  name: "He Said / She Said",
  tagline: "Pass-and-play prediction. Score divergence as conversation.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 20,
  tier: "free",
  coverGradient: ["#3a4a2a", "#100d0b"],
  description:
    "For each prompt, both of you privately write your honest answer plus your guess of the other's. Reveal scores 0–2 per round; score is incidental. The misses are the actual prize because that's where the conversation hides. Use it as a 10-minute warmup or a 90-minute opener; we don't tell you when to stop.",
  Component: HesaidshesaidBoard,
  supportsRemote: true,
};

export default hesaidshesaid;

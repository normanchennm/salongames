import type { Game } from "@/games/types";
import { ComingSoonBoard } from "@/games/_shared/ComingSoonBoard";

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
    "One of you writes a private answer to a prompt about the relationship. The other guesses what they wrote. Match scores a point — but the divergence is the actual prize, because that's where the conversation is. Use it as a 10-minute warmup or a 90-minute opener; we don't tell you when to stop.",
  Component: ComingSoonBoard,
  comingSoon: true,
};

export default hesaidshesaid;

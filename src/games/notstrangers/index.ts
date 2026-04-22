import type { Game } from "@/games/types";
import { NotStrangersBoard } from "./Board";

const notstrangers: Game = {
  id: "notstrangers",
  name: "Not Strangers",
  tagline: "Three levels of questions. How deep is up to you.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 30,
  tier: "free",
  coverGradient: ["#4a2a4a", "#100d0b"],
  description:
    "Perception, Connection, Reflection — three escalating levels of prompts for friends who want to actually talk. Pass the phone, answer honestly, pass again. Take the next level when the table feels ready. 60 prompts, emotionally honest without being grim.",
  Component: NotStrangersBoard,
};

export default notstrangers;

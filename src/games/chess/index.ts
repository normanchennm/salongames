import type { Game } from "@/games/types";
import { ChessBoard } from "./Board";

const chess: Game = {
  id: "chess",
  name: "Chess",
  tagline: "The old game. All the rules.",
  category: "abstract",
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: 40,
  tier: "free",
  coverGradient: ["#2a2a20", "#100d0b"],
  description:
    "Standard 8×8 chess with full movement rules. Castling (both sides) is enforced when king/rook haven't moved, path is clear, and the king doesn't cross a threatened square. En passant is tracked across turns. Pawns auto-promote to queen. Check / checkmate / stalemate are detected. Threefold repetition and 50-move draws are deferred.",
  Component: ChessBoard,
  supportsRemote: true,
};

export default chess;

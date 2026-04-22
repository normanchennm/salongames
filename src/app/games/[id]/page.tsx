import { notFound } from "next/navigation";
import { getGame, GAMES } from "@/games/registry";
import { GameRunner } from "./GameRunner";

/** Server-side shell for each game route. Handles generateStaticParams
 *  so the static export emits a page per registered game. The
 *  interactive logic (roster → game component → onComplete) lives in
 *  `GameRunner` which is a client component. */

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function GameRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return notFound();
  return <GameRunner gameId={game.id} />;
}

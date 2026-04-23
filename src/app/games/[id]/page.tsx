import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGame, GAMES } from "@/games/registry";
import { GameRunner } from "./GameRunner";

/** Server-side shell for each game route. Handles generateStaticParams
 *  so the static export emits a page per registered game. The
 *  interactive logic (roster → game component → onComplete) lives in
 *  `GameRunner` which is a client component. */

const SITE_URL = "https://salongames.me";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

// Per-game OG metadata so sharing a specific game link (e.g. in
// Messenger or iMessage) shows the game's own cover + tagline instead
// of the generic site card. The cover image doubles as the OG image.
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return {};
  const url = `${SITE_URL}/games/${game.id}/`;
  const image = `${SITE_URL}/covers/${game.id}.jpg`;
  const title = `${game.name} — salongames`;
  const description = game.tagline;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "salongames",
      title,
      description,
      images: [{ url: image, width: 1024, height: 1024, alt: game.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function GameRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return notFound();
  return <GameRunner gameId={game.id} />;
}

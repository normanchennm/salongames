"use client";

import { useState } from "react";
import type { Game } from "@/games/types";

/** Hero banner for the game detail page. Uses the AI-generated cover
 *  from /covers/<id>.jpg when available, with a gradient fallback that
 *  matches the card style so the page doesn't look broken pre-generation. */

export function GameHero({ game }: { game: Game }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !imageFailed;
  return (
    <div className="relative -mx-4 aspect-[16/9] overflow-hidden rounded-lg border border-border sm:mx-0">
      {showImage && (
        <img
          src={`/covers/${game.id}.jpg`}
          alt=""
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={
          showImage
            ? {
                background:
                  "linear-gradient(to top, hsl(var(--bg)) 0%, hsl(var(--bg) / 0.2) 50%, transparent 100%)",
              }
            : {
                background: `radial-gradient(circle at 30% 30%, ${game.coverGradient[0]}, ${game.coverGradient[1]} 80%)`,
              }
        }
      />
    </div>
  );
}

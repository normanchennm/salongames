"use client";

import { useState } from "react";

/** End-screen moment art. Loads /endscreens/<game>/<outcome>.jpg when
 *  present; falls back to a gradient so end screens look intentional
 *  even pre-generation. */

export interface EndScreenArtProps {
  game: string;
  outcome: string;
  fallback: [string, string];
  className?: string;
}

export function EndScreenArt({ game, outcome, fallback, className }: EndScreenArtProps) {
  const [failed, setFailed] = useState(false);
  const show = !failed;
  return (
    <div className={`relative overflow-hidden rounded-lg border border-border ${className ?? "aspect-[16/9] w-full"}`}>
      {show && (
        <img
          src={`/endscreens/${game}/${outcome}.jpg`}
          alt=""
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={
          show
            ? { background: "linear-gradient(to top, hsl(var(--bg)) 0%, hsl(var(--bg) / 0.15) 60%, transparent 100%)" }
            : { background: `radial-gradient(circle at 30% 30%, ${fallback[0]}, ${fallback[1]} 80%)` }
        }
      />
    </div>
  );
}

"use client";

import { useState } from "react";

/** Role portrait. Loads /roles/<game>/<role>.jpg when available; gracefully
 *  falls back to the provided gradient square when the file is missing
 *  (so role reveals still look intentional before the images are
 *  generated). */

export interface RoleArtProps {
  game: string;
  role: string;
  fallback: [string, string];
  /** e.g. "h-48 w-full" — sizing is caller-controlled so each game can
   *  tune the portrait presentation. */
  className?: string;
}

export function RoleArt({ game, role, fallback, className }: RoleArtProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const show = !imageFailed;
  return (
    <div className={`relative overflow-hidden rounded-lg border border-[hsl(var(--ember)/0.5)] ${className ?? "aspect-[4/3] w-full"}`}>
      {show && (
        <img
          src={`/roles/${game}/${role}.jpg`}
          alt=""
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={
          show
            ? { background: "linear-gradient(to top, hsl(var(--bg)) 0%, hsl(var(--bg) / 0.1) 50%, transparent 100%)" }
            : { background: `radial-gradient(circle at 30% 30%, ${fallback[0]}, ${fallback[1]} 80%)` }
        }
      />
    </div>
  );
}

"use client";

import { useState } from "react";

/** Decor image loader. Used for empty states and other chrome moments
 *  where an atmospheric illustration lands before or below text content.
 *  Falls back to a subtle gradient so the page still looks intentional
 *  pre-generation. */

export interface DecorArtProps {
  slot: string;
  fallback?: [string, string];
  className?: string;
}

export function DecorArt({ slot, fallback = ["#2a1a10", "#100d0b"], className }: DecorArtProps) {
  const [failed, setFailed] = useState(false);
  const show = !failed;
  return (
    <div className={`relative overflow-hidden rounded-lg border border-border ${className ?? "aspect-[16/9] w-full"}`}>
      {show && (
        <img
          src={`/decor/${slot}.jpg`}
          alt=""
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={
          show
            ? { background: "linear-gradient(to bottom, transparent 0%, hsl(var(--bg) / 0.6) 100%)" }
            : { background: `radial-gradient(circle at 30% 30%, ${fallback[0]}, ${fallback[1]} 80%)` }
        }
      />
    </div>
  );
}

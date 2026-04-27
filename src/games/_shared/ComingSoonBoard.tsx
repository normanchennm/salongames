"use client";

import type { GameComponentProps } from "@/games/types";

/** Placeholder Component for catalog-only stubs (Game.comingSoon).
 *  Should rarely actually render — GameRunner short-circuits to a
 *  CatalogStubPage when game.comingSoon is true. Kept here so the
 *  Game type's required `Component` field still validates. */

export const ComingSoonBoard: React.FC<GameComponentProps> = ({ onQuit }) => {
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center pt-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
        coming soon
      </p>
      <h2 className="mt-4 font-display text-3xl italic">Not playable yet.</h2>
      <p className="mt-4 text-sm text-muted">This one is in the works.</p>
      <button
        type="button"
        onClick={onQuit}
        className="mt-10 rounded-md border border-border px-6 py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
      >
        Back to catalog
      </button>
    </section>
  );
};

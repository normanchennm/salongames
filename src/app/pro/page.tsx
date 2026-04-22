"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Lock, Unlock } from "lucide-react";
import { loadProState, unlockProBeta } from "@/lib/pro";
import { GAMES } from "@/games/registry";

/** /pro — landing + unlock page. Beta flow: no payment, tap to unlock.
 *  Shows the current Pro content pack and tease of what's shipping
 *  next. Visible from header nav and catalog banner. */

export default function ProPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUnlocked(loadProState().unlocked);
    setHydrated(true);
  }, []);

  const unlock = () => {
    unlockProBeta();
    setUnlocked(true);
    // Give the badge a moment to land, then bounce to the catalog so
    // they can see the blurs melt.
    setTimeout(() => (typeof window !== "undefined" ? (window.location.href = "/") : null), 1200);
  };

  const proGames = GAMES.filter((g) => g.tier === "pro");

  return (
    <div className="animate-fade-up">
      <section className="py-10 text-center sm:py-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] px-3 py-1">
          <Sparkles className="h-3 w-3 text-[hsl(var(--ember))]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--ember))]">Pro · beta</span>
        </div>
        <h1 className="mx-auto mt-6 max-w-xl font-display text-5xl italic leading-[1.1] sm:text-6xl">
          New packs. Exclusive rooms. Hot drops.
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-fg/90">
          Pro unlocks every content pack we ship — late-night prompt decks, new escape rooms, narrator voice packs, premium card sets. One toggle, no accounts, no ads.
        </p>

        <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3">
          {!hydrated ? null : unlocked ? (
            <div className="w-full rounded-md border border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.1)] px-5 py-4 text-center">
              <Unlock className="mx-auto h-5 w-5 text-[hsl(var(--ember))]" />
              <p className="mt-2 font-display text-xl italic text-[hsl(var(--ember))]">Pro unlocked ✨</p>
              <p className="mt-1 text-xs text-muted">On this device, every Pro pack is yours.</p>
              <Link
                href="/"
                className="mt-4 inline-block rounded-md bg-[hsl(var(--ember))] px-5 py-2 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
              >
                Back to the catalog →
              </Link>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={unlock}
                className="w-full rounded-md bg-[hsl(var(--ember))] py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-bg transition-opacity hover:opacity-90"
              >
                Beta — Unlock Pro
              </button>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                No card · no account · no payment in beta
              </p>
            </>
          )}
        </div>
      </section>

      <div className="hairline my-4" />

      <section className="mt-10">
        <h2 className="font-display text-3xl italic">What&apos;s in the Pro pack today</h2>
        <p className="mt-2 text-sm text-muted">
          {proGames.length} game{proGames.length === 1 ? "" : "s"} currently behind the Pro gate. More packs ship every few weeks.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {proGames.map((g) => (
            <li key={g.id} className="rounded-md border border-[hsl(var(--ember)/0.4)] bg-[hsl(var(--ember)/0.04)] p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ember))]">
                  {g.category.replace("-", " ")}
                </span>
                {!unlocked && <Lock className="h-3 w-3 text-[hsl(var(--ember))]" />}
              </div>
              <h3 className="mt-1 font-display text-xl italic">{g.name}</h3>
              <p className="mt-1 text-sm leading-snug text-muted">{g.tagline}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl italic">Coming soon</h2>
        <ul className="mt-4 space-y-2">
          <ComingSoon
            title="New Fibbage pack: Weird history"
            blurb="40 more prompts, all historical and all improbable. A second deck so re-plays don't collide."
          />
          <ComingSoon
            title="Escape room: The Lighthouse"
            blurb="A storm-night coastal mystery. 5 scenes, one hour, the sort of pacing that makes people forget their phones."
          />
          <ComingSoon
            title="Narrator voice packs"
            blurb="Pick your storyteller — noir detective for Mafia, medieval bard for Avalone, gameshow host for Fibbage."
          />
          <ComingSoon
            title="Custom prompts"
            blurb="Type your own Fibbage questions, Truth-or-Dare cards, or Never-Have-I prompts. Save your table's inside jokes as decks."
          />
        </ul>
      </section>
    </div>
  );
}

function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <li className="rounded-md border border-dashed border-border bg-bg/40 p-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">Next</span>
        <h3 className="font-display text-lg italic">{title}</h3>
      </div>
      <p className="mt-1 text-sm text-muted">{blurb}</p>
    </li>
  );
}

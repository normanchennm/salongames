"use client";

import { useMemo, useState } from "react";
import type { GameComponentProps } from "@/games/types";
import { useScrollToTop } from "@/lib/useScrollToTop";
import { type Tier, pickFromTier } from "./prompts";
import { PillowTalkRemoteBoard } from "./RemoteBoard";

/** Pillow Talk — bedtime deck. No timers, no scoring, low contrast.
 *
 *  Single-screen pass-and-play (or co-viewing): pick a tier, draw a
 *  prompt, talk, draw the next. Ends whenever you choose. The whole
 *  point is that nothing is being measured. */

const TIER_LABELS: Record<Tier, string> = {
  close: "close",
  closer: "closer",
  closest: "closest",
};

const TIER_BLURB: Record<Tier, string> = {
  close: "warm-up · noticing each other",
  closer: "vulnerable · what you don't usually say",
  closest: "intimate · soft, slow, true",
};

export const PillowTalkBoard: React.FC<GameComponentProps> = (props) => {
  if (props.remote) return <PillowTalkRemoteBoard {...props} remote={props.remote} />;
  return <PillowTalkLocalBoard {...props} />;
};

const PillowTalkLocalBoard: React.FC<GameComponentProps> = ({ players, onComplete, onQuit }) => {
  const startedAt = useMemo(() => Date.now(), []);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [tier, setTier] = useState<Tier | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  useScrollToTop(`${tier ?? "intro"}-${count}`);

  function draw(t: Tier) {
    const q = pickFromTier(t, seen);
    setSeen(new Set([...seen, q]));
    setTier(t);
    setCurrent(q);
    setCount(count + 1);
  }

  function endNight() {
    onComplete({
      playedAt: new Date().toISOString(),
      players,
      winnerIds: players.map((p) => p.id),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      highlights: [`${count} prompts`],
    });
  }

  // Intro / no current card.
  if (!current) {
    return (
      <BedtimeShell>
        <section className="mx-auto max-w-md text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[hsl(var(--ember)/0.7)]">
            Pillow Talk
          </p>
          <h2 className="mt-3 font-display text-3xl italic leading-snug text-fg/80">
            No timer.<br/>No score.<br/>Just the prompt and the dark.
          </h2>
          <p className="mt-6 mx-auto max-w-sm text-sm leading-relaxed text-muted/80">
            Lower your screen brightness. Lie close. Either of you can draw a card.
            Either of you can stop whenever.
          </p>
          <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-muted/70">
            Pick a tier
          </p>
          <div className="mt-3 grid gap-2">
            {(["close", "closer", "closest"] as Tier[]).map((t) => (
              <TierButton key={t} tier={t} onClick={() => draw(t)} />
            ))}
          </div>
          <button
            type="button"
            onClick={onQuit}
            className="mt-8 w-full font-mono text-[10px] uppercase tracking-[0.3em] text-muted/60"
          >
            Back
          </button>
        </section>
      </BedtimeShell>
    );
  }

  return (
    <BedtimeShell>
      <section className="mx-auto max-w-md">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-muted/60">
          <span>{TIER_LABELS[tier!]}</span>
          <span>{count} drawn</span>
        </div>
        <div className="mt-6 rounded-lg border border-[hsl(var(--ember)/0.2)] bg-[hsl(var(--ember)/0.04)] px-6 py-12">
          <p className="font-display text-2xl italic leading-snug text-fg/85">
            {current}
          </p>
        </div>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted/50">
          {TIER_BLURB[tier!]}
        </p>
        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-muted/70 text-center">
          Draw another
        </p>
        <div className="mt-3 grid gap-2">
          {(["close", "closer", "closest"] as Tier[]).map((t) => (
            <TierButton
              key={t}
              tier={t}
              onClick={() => draw(t)}
              dim={t !== tier}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={endNight}
          className="mt-8 w-full font-mono text-[10px] uppercase tracking-[0.3em] text-muted/60"
        >
          Set the deck down · {count} drawn
        </button>
      </section>
    </BedtimeShell>
  );
};

function TierButton({
  tier,
  onClick,
  dim = false,
}: {
  tier: Tier;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-baseline justify-between rounded-md border border-border/60 bg-bg/30 px-4 py-3 text-left transition-colors hover:border-[hsl(var(--ember)/0.4)] ${dim ? "opacity-60" : ""}`}
    >
      <span className="font-display text-lg italic text-fg/85">{TIER_LABELS[tier]}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted/60 group-hover:text-[hsl(var(--ember)/0.7)]">
        {TIER_BLURB[tier]}
      </span>
    </button>
  );
}

/** Outer container: dims the page (lower brightness, deeper bg) so the
 *  card glows against a near-black field. The whole game is meant to
 *  be read in the dark. */
function BedtimeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 -my-2 rounded-md bg-[#0a0808] px-4 py-12 sm:-mx-6 sm:py-16">
      {children}
    </div>
  );
}

import Link from "next/link";
import { GameCard } from "@/components/GameCard";
import { DecorArt } from "@/components/DecorArt";
import { DatingModeToggle } from "@/components/DatingModeToggle";
import { DateNightAdultSection } from "@/components/DateNightAdultSection";
import { GAMES } from "@/games/registry";

/** Date Night — a curated view of the catalog framed for couples /
 *  dates, not for friend groups. Same games, different pitch. The
 *  catalog page still shows everything; this page is a landing
 *  designed to be shared on dating/social media ("tried this on our
 *  third date, here's what happened"). */

interface Pick {
  id: string;
  pitch: string;
}

// Tiers map to ~3 dating beats most couples navigate.
const TIERS: { heading: string; subline: string; picks: Pick[] }[] = [
  {
    heading: "Breaking the ice",
    subline: "Low stakes. Keep it moving. Save the phone for summoning the Uber.",
    picks: [
      { id: "twotruths",       pitch: "The original first-date game. Two facts, one fib, and a chance to ask what's really behind that story." },
      { id: "wouldyourather",  pitch: "60 dilemmas. No wrong answers. You'll learn more about their values from 'desert or tundra?' than three Hinge prompts." },
      { id: "rpsls",           pitch: "Three minutes. Settles who's picking the next bar. You'll laugh." },
      { id: "hangman",         pitch: "One word, six wrong guesses. Small enough to play between courses." },
    ],
  },
  {
    heading: "Actually getting to know each other",
    subline: "For when the surface is cleared and you both feel it.",
    picks: [
      { id: "notstrangers",    pitch: "Three levels of prompts — Perception, Connection, Reflection. Most couples stop at level 2. The ones who don't usually end up in love." },
      { id: "neverhaveiever",  pitch: "Dangerous and fun. Read the room before level three." },
      { id: "insider",         pitch: "One of you knows the secret word. The other is trying to figure it out. Weirdly intimate." },
      { id: "fibbage",         pitch: "Real trivia, fake answers. Watching how someone bluffs tells you everything." },
    ],
  },
  {
    heading: "A story together",
    subline: "Shared experience beats small talk. Bonus: you'll have something to tell your friends about later.",
    picks: [
      { id: "escaperoom",      pitch: "The cursed antique shop or the 1928 hotel murder. 15-20 minutes, side by side, one device. The best kind of third-date." },
      { id: "telephonepictwo", pitch: "You write something weird. They draw it. You caption their drawing. By the end you have a tiny artifact of the night to screenshot." },
      { id: "codenames",       pitch: "Two vs two works for double dates. You'll learn who thinks in metaphor and who thinks in categories. Important data." },
    ],
  },
  {
    heading: "One-on-one, quick and competitive",
    subline: "For the restless type, or anyone who wants to trash-talk a little.",
    picks: [
      { id: "tictactoe",       pitch: "Five rounds, first to three. Loser picks dessert." },
      { id: "connect4",        pitch: "Feels simple, turns brutal. Ends fast enough to play eight rounds." },
      { id: "chess",           pitch: "If you both play, you already know. If one of you is learning, teach them." },
      { id: "reversi",         pitch: "Also called Othello. Easier than chess, harder than it looks. Fifteen minutes per match." },
    ],
  },
];

export default function DatePage() {
  // Map ids to full game objects for GameCard.
  const byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));

  return (
    <div className="animate-fade-up">
      <section className="relative py-12 text-center sm:py-16">
        <DecorArt slot="hero-about" className="absolute inset-0 -z-10 aspect-auto h-full w-full opacity-40" />
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Date night</p>
        <h1 className="mx-auto mt-4 max-w-xl font-display text-5xl italic leading-[1.1] sm:text-6xl">
          Put the phone down. Play something together.
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-fg/90">
          <span className="font-display italic">A dozen games from the salongames library</span>, curated for the person across the table from you. Pass-and-play on one device. No accounts, no ads, no small talk.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="#first-date" className="rounded-md border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.06)] px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-[hsl(var(--ember))] transition-colors hover:bg-[hsl(var(--ember)/0.12)]">
            See the picks ↓
          </a>
          <Link href="/" className="rounded-md border border-border px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg">
            Full catalog
          </Link>
        </div>
        <div className="mt-6 flex justify-center">
          <DatingModeToggle />
        </div>
      </section>

      <div className="hairline my-4" />

      {TIERS.map((tier, i) => (
        <section key={tier.heading} id={i === 0 ? "first-date" : undefined} className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-3xl italic">{tier.heading}</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              {tier.picks.length} picks
            </span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted">{tier.subline}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tier.picks.map((pick) => {
              const game = byId[pick.id];
              if (!game) return null;
              return (
                <div key={pick.id} className="flex flex-col gap-3">
                  <GameCard game={game} />
                  <p className="px-1 text-sm italic leading-relaxed text-fg/85">{pick.pitch}</p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <DateNightAdultSection />

      <section className="mt-20 rounded-lg border border-[hsl(var(--ember)/0.3)] bg-[hsl(var(--ember)/0.04)] p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
          How it works
        </p>
        <h3 className="mt-3 font-display text-3xl italic">One device. One evening. No apps to install.</h3>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">
          Everything runs in your browser. Add it to your home screen and it works offline — perfect for a restaurant with bad wifi. Your scores and play history stay on your phone. We don&apos;t have accounts and we don&apos;t want any.
        </p>
      </section>
    </div>
  );
}

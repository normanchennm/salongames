import { Wordmark } from "@/components/Wordmark";
import { GameCard } from "@/components/GameCard";
import { GAMES } from "@/games/registry";

export default function Home() {
  return (
    <div className="animate-fade-up">
      <section className="py-16 text-center sm:py-24">
        <Wordmark variant="stacked" size="lg" />
        <p className="mx-auto mt-10 max-w-md text-lg leading-relaxed text-fg/90">
          <span className="font-display italic">A library of pass-and-play party games</span>{" "}
          for friends gathered in person. One device, passed around. No
          accounts, no servers, no data collected.
        </p>
      </section>

      <div className="hairline my-4" />

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl italic">The library</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            {GAMES.length} {GAMES.length === 1 ? "game" : "games"}
          </span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      </section>
    </div>
  );
}

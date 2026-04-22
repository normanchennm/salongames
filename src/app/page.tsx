import { Wordmark } from "@/components/Wordmark";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import { GAMES } from "@/games/registry";

export default function Home() {
  return (
    <div className="animate-fade-up">
      <section className="py-12 text-center sm:py-20">
        <Wordmark variant="stacked" size="lg" />
        <p className="mx-auto mt-10 max-w-md text-lg leading-relaxed text-fg/90">
          <span className="font-display italic">A library of pass-and-play party games</span>{" "}
          for friends gathered in person. One device, passed around. No
          accounts, no servers, no data collected.
        </p>
      </section>

      <div className="hairline my-4" />

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl italic">The library</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            {GAMES.length} games
          </span>
        </div>
        <div className="mt-6">
          <CatalogBrowser games={GAMES} />
        </div>
      </section>
    </div>
  );
}

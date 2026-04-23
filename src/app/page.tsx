import { Wordmark } from "@/components/Wordmark";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import { GAMES } from "@/games/registry";

// Editorial colophon bits. Bump the issue when we reshuffle the Popular
// list or add a themed drop — cheap conceit that makes the catalog read
// as authored rather than auto-generated.
const ISSUE = "Vol. I";
const ISSUE_DATE = "MMXXVI";

export default function Home() {
  return (
    <div>
      {/* Hero — deliberately asymmetric. Wordmark anchors left, the
          pull-quote breaks into the right column, a marginalia label
          rides the far page edge on large screens. Negative space is
          doing the work. */}
      <section className="relative grid grid-cols-12 gap-4 py-16 sm:py-24">
        <div className="col-span-12 animate-fade-up sm:col-span-6 sm:col-start-1">
          <Wordmark variant="stacked" size="lg" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
            {ISSUE} · {ISSUE_DATE} · Curated
          </p>
        </div>

        <div
          className="col-span-12 animate-fade-up sm:col-span-6 sm:col-start-7 sm:-mt-4 sm:pl-8"
          style={{ animationDelay: "0.08s", animationFillMode: "backwards" }}
        >
          <blockquote className="font-display italic text-3xl leading-[1.08] text-fg/95 sm:text-4xl">
            <span className="text-[hsl(var(--ember))]">“</span>
            A library of pass-and-play &amp; multi-device party games,
            set for friends gathered around a table
            <span className="text-[hsl(var(--ember))]">.”</span>
          </blockquote>
          <p
            className="mt-6 max-w-sm animate-fade-up font-mono text-xs leading-relaxed text-muted"
            style={{ animationDelay: "0.18s", animationFillMode: "backwards" }}
          >
            Everyone joins from their own phone, or share one —&nbsp;the
            room code reads the same on any screen. No accounts. No
            servers we operate. Nothing to install.
          </p>
        </div>

        {/* Marginalia — ember vertical issue tag on large screens only.
            Ornamental, low-impact, but establishes the magazine tone. */}
        <div className="pointer-events-none absolute -right-8 top-0 bottom-0 hidden lg:block">
          <div
            className="marginalia whitespace-nowrap text-[hsl(var(--ember-soft))]"
            aria-hidden
          >
            salon · games · collection {ISSUE_DATE}
          </div>
        </div>
      </section>

      <div className="hairline-heavy my-6" />

      {/* Library header. Roman-numeral section marker + filigree. */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[hsl(var(--ember))]">
              § I
            </p>
            <h2 className="mt-1 font-display text-4xl italic leading-[0.95] sm:text-5xl">
              The library
            </h2>
          </div>
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            {GAMES.length} titles &middot; {ISSUE_DATE}
          </span>
        </div>
        <div className="mt-10">
          <CatalogBrowser games={GAMES} />
        </div>
      </section>
    </div>
  );
}

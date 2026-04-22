import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md animate-fade-up py-20 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">404</p>
      <h1 className="mt-3 font-display text-6xl italic">Lost the plot.</h1>
      <p className="mt-4 text-muted">
        That page isn't in the catalog. Pick a game from the library instead.
      </p>
      <Link
        href="/"
        className="mt-10 inline-block rounded-md bg-[hsl(var(--ember))] px-6 py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
      >
        Back to the library →
      </Link>
    </div>
  );
}

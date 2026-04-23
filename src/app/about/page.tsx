export default function About() {
  return (
    <article className="prose mx-auto max-w-2xl animate-fade-up">
      <h1 className="font-display text-4xl italic">About salongames</h1>
      <p className="mt-4 text-fg/90">
        A library of party games designed for friends gathered around a
        table. Pass one phone around — it does the narration, role reveals,
        timers, vote counting — or everyone joins their own phone with a
        five-letter room code. Either way: no install, no account, no data
        collected about you. Every game is a plain web page.
      </p>
      <p className="mt-4 text-fg/90">
        For multi-device play we broker a short peer-to-peer handshake
        through a tiny signaling server, then the phones talk directly to
        each other. Game state — names, votes, roles — never touches any
        server after that. Close the tab and it's gone.
      </p>
      <p className="mt-4 font-display italic text-muted">
        — a companion project from the makers of stashd.
      </p>
    </article>
  );
}

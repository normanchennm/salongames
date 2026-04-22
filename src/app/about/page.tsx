export default function About() {
  return (
    <article className="prose mx-auto max-w-2xl animate-fade-up">
      <h1 className="font-display text-4xl italic">About salongames</h1>
      <p className="mt-4 text-fg/90">
        A library of pass-and-play party games for friends who are in the same
        room. One phone, passed around, does the narration, the role reveals,
        the timers, the vote counting. Every game loads as a plain web page;
        no install, no account, no data collected.
      </p>
      <p className="mt-4 text-fg/90">
        There's no server here, no cloud multiplayer, no matchmaking. If you
        can gather five or more people in the same room with one charged phone
        between them, you can play.
      </p>
      <p className="mt-4 font-display italic text-muted">
        — a companion project from the makers of stashd.
      </p>
    </article>
  );
}

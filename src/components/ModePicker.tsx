"use client";

/** Mode picker shown on the game detail page when a game supports
 *  remote play. Multi-device is primary — it gets the large card with
 *  the faux-code metaphor. Join-with-a-code rides underneath at half
 *  weight. Pass-and-play is a single hairline link at the bottom, only
 *  shown when the game is tagged as reasonable on one phone. */

export type PlayMode = "local" | "remote-host" | "remote-join";

// Rotate through a few visually-distinctive letters so the metaphor
// feels alive. Chosen from the code alphabet in src/lib/room.ts
// (no 0/O/I/1) and set in Fraunces italic with WONK on for character.
const CODE_SAMPLES = ["HDRE7", "NVQ3Z", "LYBM8", "KTPF4"];

export function ModePicker({
  onPick,
  allowLocal = true,
}: {
  onPick: (mode: PlayMode) => void;
  allowLocal?: boolean;
}) {
  // Pick a sample once per mount — stable across re-renders within the
  // same detail view, different each time you visit a game page.
  const sample = CODE_SAMPLES[Math.floor(Math.random() * CODE_SAMPLES.length)];

  return (
    <div className="animate-fade-up">
      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[hsl(var(--ember))]">
        § Playing
      </p>
      <h2 className="mt-2 font-display text-3xl italic leading-[0.95] sm:text-4xl">
        Invite your table.
      </h2>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
        Everyone plays on their own phone. Same room or across cities —
        it works the same way. Private roles stay private, no passing.
      </p>

      {/* Primary — Host a room. Grid-breaking, asymmetric. The code
          metaphor on the right is the hero; the CTA copy is small,
          the gesture is "open the door." */}
      <button
        type="button"
        onClick={() => onPick("remote-host")}
        className="group relative mt-8 block w-full overflow-hidden rounded-sm border border-[hsl(var(--ember-soft))] bg-gradient-to-br from-[hsl(var(--ember)/0.08)] via-bg/40 to-bg/60 p-6 text-left transition-colors hover:border-[hsl(var(--ember))] sm:p-8"
      >
        <div className="grid grid-cols-12 items-center gap-6">
          {/* Left: call-to-action + label */}
          <div className="col-span-12 sm:col-span-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
              I. Host a room
            </p>
            <h3 className="mt-3 font-display text-4xl italic leading-[0.95] text-fg sm:text-5xl">
              Open the door.
            </h3>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              Create a 5-letter code. Share it with the table. Friends
              join from whatever phone they have.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--ember))] transition-transform group-hover:translate-x-1">
              host a room
              <span aria-hidden>→</span>
            </p>
          </div>
          {/* Right: code metaphor */}
          <div className="col-span-12 sm:col-span-5">
            <div className="relative">
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted/70">
                your code
              </p>
              <p
                className="code-hero mt-2 text-[56px] leading-none text-[hsl(var(--ember))] sm:text-[72px]"
                aria-hidden
              >
                {sample}
              </p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.3em] text-muted/60">
                (a new one each time)
              </p>
            </div>
          </div>
        </div>

        {/* Hairline across the bottom on hover — "door opening" cue. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--ember))] to-transparent opacity-50 transition-opacity duration-300 group-hover:opacity-100"
        />
      </button>

      {/* Secondary — Join with a code. Half-weight, plain. */}
      <button
        type="button"
        onClick={() => onPick("remote-join")}
        className="group mt-3 flex w-full items-center justify-between rounded-sm border border-border bg-bg/30 px-6 py-4 text-left transition-colors hover:border-[hsl(var(--ember-soft))]"
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
            II. Someone else is hosting?
          </p>
          <p className="mt-1 font-display text-xl italic text-fg">
            Join with a code.
          </p>
        </div>
        <span
          aria-hidden
          className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted transition-all group-hover:translate-x-1 group-hover:text-[hsl(var(--ember))]"
        >
          enter code →
        </span>
      </button>

      {/* Fallback — hairline link only when localFriendly. */}
      {allowLocal && (
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => onPick("local")}
            className="group inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted transition-colors hover:text-fg"
          >
            <span
              aria-hidden
              className="h-px w-8 bg-border transition-colors group-hover:bg-[hsl(var(--ember-soft))]"
            />
            only one phone? pass-and-play
            <span
              aria-hidden
              className="h-px w-8 bg-border transition-colors group-hover:bg-[hsl(var(--ember-soft))]"
            />
          </button>
        </div>
      )}
    </div>
  );
}

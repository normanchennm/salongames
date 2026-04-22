"use client";

import { ArrowRight } from "lucide-react";

/** Shared pass-phone handoff screen. Used everywhere a game says
 *  "pass to X". Not auto-wired across all 45 games (too invasive in
 *  one pass), but new games should reach for this instead of writing
 *  their own variant — it bakes in the consistent label + button layout
 *  so the whole catalog feels like one product. */

export interface PassPhoneProps {
  /** Short label above the headline, e.g. "Vote 2 / 4" or "Reveal". */
  label?: string;
  /** Name of the next holder, e.g. "Alice". */
  name: string;
  /** Optional subtitle, e.g. "Only you should see the next screen." */
  subtitle?: string;
  /** What the primary button does when the new holder is ready. */
  onReady: () => void;
  /** Primary button text override. Defaults to "I'm {name} — continue →". */
  continueLabel?: string;
}

export function PassPhone({ label, name, subtitle, onReady, continueLabel }: PassPhoneProps) {
  return (
    <section className="mx-auto max-w-md animate-fade-up text-center">
      {label && (
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{label}</p>
      )}
      <h2 className="mt-6 font-display text-4xl italic">Pass to {name}.</h2>
      {subtitle && <p className="mt-4 text-sm text-muted">{subtitle}</p>}
      <button
        type="button"
        onClick={onReady}
        className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
      >
        {continueLabel ?? <>I&apos;m {name} <ArrowRight className="h-3 w-3" /></>}
      </button>
    </section>
  );
}

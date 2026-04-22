import Link from "next/link";

/** The salongames wordmark lockup. Two variants:
 *
 *  - `inline`: `salon` (Fraunces italic, ember) + `games` (Geist Mono,
 *    muted) set as one continuous word. Primary brand mark. Used in
 *    headers, footers, social, favicon-adjacent.
 *  - `stacked`: `salon` over `GAMES` with the mono half in small-caps
 *    below. App-icon / hero treatment.
 *
 *  Sizing: `sm` (12px mono / 16px serif) for footer hints, `md` (20/30)
 *  for the header, `lg` (40/60) for hero displays, `xl` (64/96) for
 *  icon-grade lockups.
 *
 *  Colors match the ember + muted accent system from globals.css. No
 *  images — type is type — so the mark scales perfectly on any DPR. */

export interface WordmarkProps {
  variant?: "inline" | "stacked";
  size?: "sm" | "md" | "lg" | "xl";
  /** When provided, the wordmark is rendered as a Link to that href. */
  href?: string;
  className?: string;
}

const SIZES: Record<NonNullable<WordmarkProps["size"]>, { serif: string; mono: string; stackedSerif: string; stackedMono: string }> = {
  sm: { serif: "text-base", mono: "text-sm", stackedSerif: "text-lg", stackedMono: "text-[10px]" },
  md: { serif: "text-3xl", mono: "text-2xl", stackedSerif: "text-4xl", stackedMono: "text-xs" },
  lg: { serif: "text-6xl", mono: "text-5xl", stackedSerif: "text-7xl", stackedMono: "text-sm" },
  xl: { serif: "text-8xl", mono: "text-7xl", stackedSerif: "text-9xl", stackedMono: "text-base" },
};

export function Wordmark({ variant = "inline", size = "md", href, className = "" }: WordmarkProps) {
  const s = SIZES[size];

  const inline = (
    <span className={`inline-flex items-baseline ${className}`}>
      <span
        className={`font-display italic font-semibold tracking-tight text-[hsl(var(--ember))] ${s.serif}`}
      >
        salon
      </span>
      <span className={`font-mono text-muted ${s.mono}`}>games</span>
    </span>
  );

  const stacked = (
    <span className={`inline-flex flex-col items-start leading-none ${className}`}>
      <span
        className={`font-display italic font-semibold tracking-tight text-[hsl(var(--ember))] ${s.stackedSerif}`}
      >
        salon
      </span>
      <span className={`mt-2 font-mono uppercase tracking-[0.3em] text-muted ${s.stackedMono}`}>
        games
      </span>
    </span>
  );

  const content = variant === "stacked" ? stacked : inline;

  if (href) {
    return (
      <Link href={href} className="group transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }
  return content;
}

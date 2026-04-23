import Link from "next/link";

/** The salongames wordmark lockup. The serif half is Fraunces pushed
 *  on SOFT + WONK axes so each glyph has genuine character — the two
 *  o's ripple, the 'l' and 'n' lean into each other. That's the mark.
 *
 *  Variants:
 *
 *  - `inline`: `salon` (Fraunces italic, ember) + `games` (Geist Mono,
 *    muted) set as one continuous word. Primary brand mark.
 *  - `stacked`: `salon` over `GAMES` with the mono half in small-caps
 *    below — app-icon / hero treatment. */

export interface WordmarkProps {
  variant?: "inline" | "stacked";
  size?: "sm" | "md" | "lg" | "xl";
  href?: string;
  className?: string;
}

const SIZES: Record<
  NonNullable<WordmarkProps["size"]>,
  { serif: string; mono: string; stackedSerif: string; stackedMono: string }
> = {
  sm: { serif: "text-base", mono: "text-sm", stackedSerif: "text-lg", stackedMono: "text-[10px]" },
  md: { serif: "text-3xl", mono: "text-2xl", stackedSerif: "text-4xl", stackedMono: "text-xs" },
  lg: { serif: "text-6xl", mono: "text-5xl", stackedSerif: "text-7xl sm:text-8xl", stackedMono: "text-sm" },
  xl: { serif: "text-8xl", mono: "text-7xl", stackedSerif: "text-9xl", stackedMono: "text-base" },
};

// Push Fraunces variable axes hard for the wordmark specifically —
// WONK on, SOFT near max. The mark reads different from body copy.
const WORDMARK_FVS = `"SOFT" 100, "WONK" 1, "opsz" 144`;

export function Wordmark({ variant = "inline", size = "md", href, className = "" }: WordmarkProps) {
  const s = SIZES[size];

  const inline = (
    <span className={`inline-flex items-baseline ${className}`}>
      <span
        className={`font-display italic font-semibold tracking-[-0.015em] text-[hsl(var(--ember))] ${s.serif}`}
        style={{ fontVariationSettings: WORDMARK_FVS }}
      >
        salon
      </span>
      <span className={`font-mono text-muted ${s.mono}`}>games</span>
    </span>
  );

  const stacked = (
    <span className={`inline-flex flex-col items-start leading-[0.82] ${className}`}>
      <span
        className={`font-display italic font-semibold tracking-[-0.02em] text-[hsl(var(--ember))] ${s.stackedSerif}`}
        style={{ fontVariationSettings: WORDMARK_FVS }}
      >
        salon
      </span>
      <span
        className={`mt-2 font-mono uppercase tracking-[0.42em] text-muted ${s.stackedMono}`}
      >
        — games
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

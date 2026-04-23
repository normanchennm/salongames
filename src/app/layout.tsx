import type { Metadata } from "next";
import { Fraunces, Geist_Mono } from "next/font/google";
import { Wordmark } from "@/components/Wordmark";
import { MuteToggle } from "@/components/MuteToggle";
import { RegisterSW } from "@/components/RegisterSW";
import { FeedbackButton } from "@/components/FeedbackButton";
import "./globals.css";

// Fraunces for the editorial "salon" half of the wordmark + display copy.
// Geist Mono for the "games" half + body UI. This pairing mirrors stashd's
// type system so the two properties read as sibling brands.
const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://salongames.me";
const OG_TITLE = "salongames — pass-and-play party games";
const OG_DESCRIPTION =
  "A library of pass-and-play party games for friends gathered in person. Werewolf, Mafia, Spyfall, Charades, Trivia and more — on one device, no accounts, no servers.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: OG_TITLE,
  description: OG_DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "salongames",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [
      { url: "/og.png", width: 1200, height: 630, alt: "salongames — pass-and-play party games" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: ["/og.png"],
  },
  other: { robots: "index, follow" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-bg text-fg">
        <RegisterSW />
        <header className="border-b border-border/70">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
            {/* Two wordmarks so the mobile header doesn't crowd —
                smaller on phone, full display size sm+. */}
            <span className="sm:hidden">
              <Wordmark variant="inline" size="sm" href="/" />
            </span>
            <span className="hidden sm:inline-flex">
              <Wordmark variant="inline" size="md" href="/" />
            </span>
            <nav className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted sm:gap-5 sm:tracking-[0.25em]">
              <a href="/" className="transition-colors hover:text-fg">
                <span className="hidden sm:inline">§ </span>games
              </a>
              <a href="/date/" className="transition-colors hover:text-fg">
                <span className="hidden sm:inline">§ </span>
                <span className="sm:hidden">date</span>
                <span className="hidden sm:inline">date night</span>
              </a>
              <a
                href="/pro/"
                className="text-[hsl(var(--ember))] transition-opacity hover:opacity-80"
              >
                <span className="hidden sm:inline">§ </span>pro
              </a>
              <a href="/stats/" className="transition-colors hover:text-fg">
                <span className="hidden sm:inline">§ </span>stats
              </a>
              <MuteToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <FeedbackButton />
        <footer className="mt-16 border-t border-border/70">
          <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-4 px-4 py-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted sm:gap-6 sm:px-6 sm:py-8 sm:tracking-[0.25em]">
            <Wordmark variant="inline" size="sm" />
            <span className="text-muted/80">
              each on your own phone — or pass one around
            </span>
            <span className="text-muted/60">
              — fin
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}

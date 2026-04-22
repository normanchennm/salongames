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

const SITE_URL = "https://www.salongames.live";
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
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
            <Wordmark variant="inline" size="md" href="/" />
            <nav className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              <a href="/" className="transition-colors hover:text-fg">Games</a>
              <a href="/date/" className="transition-colors hover:text-fg">Date night</a>
              <a href="/pro/" className="inline-flex items-center gap-1 text-[hsl(var(--ember))] transition-opacity hover:opacity-80">
                ✨ Pro
              </a>
              <a href="/stats/" className="transition-colors hover:text-fg">Stats</a>
              <MuteToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <FeedbackButton />
        <footer className="mt-16 border-t border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <Wordmark variant="inline" size="sm" />
            <span>pass and play · no servers · no accounts</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

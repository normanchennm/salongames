import type { Metadata } from "next";
import { Fraunces, Geist_Mono } from "next/font/google";
import { Wordmark } from "@/components/Wordmark";
import { MuteToggle } from "@/components/MuteToggle";
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

export const metadata: Metadata = {
  title: "salongames — pass-and-play party games",
  description:
    "A library of pass-and-play party games for friends gathered in person. Werewolf, Mafia, Spyfall, charades, and more — on one device, no accounts, no servers.",
  other: { robots: "index, follow" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-bg text-fg">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
            <Wordmark variant="inline" size="md" href="/" />
            <nav className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              <a href="/" className="transition-colors hover:text-fg">Games</a>
              <a href="/about/" className="transition-colors hover:text-fg">About</a>
              <MuteToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
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

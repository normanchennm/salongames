import type { MetadataRoute } from "next";
import { GAMES } from "@/games/registry";

// Required for `output: "export"` — Next won't emit a route-handler
// sitemap unless the route is explicitly static.
export const dynamic = "force-static";

/** Build-time sitemap. Next's static export emits this as
 *  /sitemap.xml under the `out/` directory, which Azure SWA serves
 *  directly. Referenced from /robots.txt so crawlers can discover
 *  the full game catalog without having to follow internal links.
 *
 *  Admin / API / stats are intentionally excluded — they're
 *  either device-local, auth-gated, or not useful in search. */

const BASE = "https://salongames.me";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const topLevel: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/date/`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/pro/`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/about/`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];

  const catalog: MetadataRoute.Sitemap = GAMES.map((g) => ({
    url: `${BASE}/games/${g.id}/`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...topLevel, ...catalog];
}

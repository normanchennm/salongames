"use client";

import { useEffect, useMemo, useState } from "react";
import { loadLocalFeedback, type FeedbackEntry } from "@/lib/feedback";
import { GAMES } from "@/games/registry";

/** Admin page (single-admin MVP). Stores the admin token in
 *  sessionStorage after the first successful fetch so reloads don't
 *  re-prompt. Token is matched server-side against the ADMIN_TOKEN
 *  app setting — weak by design (no user system), but fine for
 *  Norman-only access. */

const K_TOKEN = "salongames:adminToken:v1";

interface Summary {
  days: number;
  uniqueDevices: number;
  totalEvents: number;
  byName: Record<string, number>;
  gameStarts: Record<string, number>;
  gameCompletes: Record<string, number>;
  gameQuits: Record<string, number>;
  recent: { partitionKey?: string; rowKey?: string; name?: string; props?: Record<string, unknown>; ts?: string; deviceId?: string; route?: string }[];
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [feedback, setFeedback] = useState<FeedbackEntry[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = window.sessionStorage.getItem(K_TOKEN);
      if (cached) {
        setToken(cached);
        setTokenInput(cached);
      }
    }
  }, []);

  const fetchAll = async (t: string, d: number) => {
    setLoading(true);
    setError(null);
    try {
      const [fb, sm] = await Promise.all([
        fetch(`/api/feedback`, { headers: { "x-admin-token": t } }),
        fetch(`/api/event/summary?days=${d}`, { headers: { "x-admin-token": t } }),
      ]);
      if (fb.status === 401 || sm.status === 401) {
        setError("Unauthorized — wrong token.");
        setLoading(false);
        return;
      }
      const fbJson = fb.ok ? await fb.json() : { items: [] };
      const smJson = sm.ok ? await sm.json() : null;
      setFeedback(fbJson.items ?? []);
      setSummary(smJson);
      if (typeof window !== "undefined") window.sessionStorage.setItem(K_TOKEN, t);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (token) fetchAll(token, days);
  }, [token, days]);

  const gameName = (id: string) => GAMES.find((g) => g.id === id)?.name ?? id;

  const localOutbox = useMemo(() => (typeof window === "undefined" ? [] : loadLocalFeedback()), []);

  if (!token) {
    return (
      <div className="mx-auto max-w-md animate-fade-up py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Admin</p>
        <h1 className="mt-2 font-display text-4xl italic">Who goes there?</h1>
        <p className="mt-4 text-sm text-muted">Enter your admin token to view feedback + telemetry.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setToken(tokenInput.trim());
          }}
          className="mt-6 flex gap-2"
        >
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="admin token"
            className="flex-1 rounded-md border border-border bg-bg/40 px-3 py-2 font-mono text-sm focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
          />
          <button type="submit" className="rounded-md bg-[hsl(var(--ember))] px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg">
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">Admin</p>
          <h1 className="mt-2 font-display text-4xl italic">Salon ops</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="rounded-md border border-border bg-bg/40 px-2 py-1 font-mono text-xs"
          >
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
          <button
            type="button"
            onClick={() => token && fetchAll(token, days)}
            className="rounded-md border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
          >
            {loading ? "…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.sessionStorage.removeItem(K_TOKEN);
              setToken("");
              setTokenInput("");
            }}
            className="rounded-md border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
          >
            Lock
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.08)] p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[hsl(var(--ember))]">{error}</p>
        </div>
      )}

      {summary && (
        <>
          <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            <Tile label={`Devices (last ${summary.days}d)`} value={String(summary.uniqueDevices)} />
            <Tile label="Total events" value={String(summary.totalEvents)} />
            <Tile label="Feedback items" value={String(feedback?.length ?? 0)} />
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl italic">Top events</h2>
            <ul className="mt-3 divide-y divide-border/60 rounded-md border border-border bg-bg/40">
              {Object.entries(summary.byName)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 15)
                .map(([name, n]) => (
                  <li key={name} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="font-mono text-xs text-fg">{name}</span>
                    <span className="font-mono tabular-nums text-muted">{n}</span>
                  </li>
                ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl italic">Game funnel</h2>
            <div className="mt-3 overflow-hidden rounded-md border border-border bg-bg/40">
              <table className="w-full text-xs">
                <thead className="bg-bg/60">
                  <tr className="text-left font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                    <th className="px-3 py-2">Game</th>
                    <th className="px-3 py-2 text-right">Starts</th>
                    <th className="px-3 py-2 text-right">Completes</th>
                    <th className="px-3 py-2 text-right">Quits</th>
                    <th className="px-3 py-2 text-right">Completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {Array.from(
                    new Set([
                      ...Object.keys(summary.gameStarts),
                      ...Object.keys(summary.gameCompletes),
                      ...Object.keys(summary.gameQuits),
                    ]),
                  )
                    .map((id) => {
                      const s = summary.gameStarts[id] ?? 0;
                      const c = summary.gameCompletes[id] ?? 0;
                      const q = summary.gameQuits[id] ?? 0;
                      return { id, s, c, q };
                    })
                    .sort((a, b) => b.s - a.s)
                    .slice(0, 25)
                    .map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 font-display italic">{gameName(row.id)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{row.s}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{row.c}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{row.q}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[hsl(var(--ember))]">
                          {row.s > 0 ? Math.round((row.c / row.s) * 100) + "%" : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl italic">Feedback</h2>
        <ul className="mt-3 space-y-2">
          {(feedback ?? []).map((f, i) => (
            <li key={(f as unknown as { rowKey?: string }).rowKey ?? i} className="rounded-md border border-border bg-bg/40 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                {new Date(f.createdAt).toLocaleString()} · {f.route || "/"}{f.email ? ` · ${f.email}` : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{f.message}</p>
            </li>
          ))}
          {feedback && feedback.length === 0 && (
            <li className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted">
              No server-side feedback yet.
            </li>
          )}
        </ul>
        {localOutbox.length > 0 && (
          <div className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Local outbox on this device ({localOutbox.length})
            </p>
            <ul className="mt-2 space-y-1">
              {localOutbox.slice(0, 10).map((f) => (
                <li key={f.id} className="rounded-md border border-border/60 bg-bg/30 p-3 text-xs">
                  <span className="font-mono text-[10px] uppercase text-muted">{f.status}</span>
                  <p className="mt-1 text-fg">{f.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="mt-2 font-display text-4xl italic text-[hsl(var(--ember))]">{value}</div>
    </div>
  );
}

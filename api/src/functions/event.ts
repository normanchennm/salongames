import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { eventsTable } from "../shared/tables";

/** POST /api/event — accept a batch of telemetry events and append
 *  each to the events table. Fire-and-forget from the client so we
 *  return 204 quickly; failures per-row are logged but don't fail the
 *  request. */

app.http("event", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (req.method === "OPTIONS") return { status: 204, headers: cors };

    let body: { events?: Array<Record<string, unknown>> };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return { status: 204, headers: cors };
    }
    const events = Array.isArray(body.events) ? body.events : [];
    if (events.length === 0) return { status: 204, headers: cors };

    const table = eventsTable();
    await table.createTable().catch(() => {});

    // Partition by yyyy-mm-dd for efficient day-level queries in the
    // admin page. Row key is reverse-chrono so listEntities returns
    // newest first cheaply.
    const today = new Date().toISOString().slice(0, 10);
    for (const [i, evt] of events.entries()) {
      try {
        await table.createEntity({
          partitionKey: today,
          rowKey: `${Number.MAX_SAFE_INTEGER - Date.now()}_${i}`,
          name: String(evt.name ?? ""),
          props: JSON.stringify(evt.props ?? {}),
          ts: String(evt.ts ?? new Date().toISOString()),
          deviceId: String(evt.deviceId ?? ""),
          route: String(evt.route ?? ""),
          ua: req.headers.get("user-agent") ?? "",
        });
      } catch (err) {
        ctx.log("event insert failed", (err as Error).message);
      }
    }
    return { status: 204, headers: cors };
  },
});

/** GET /api/event/summary — admin-only aggregation over the last N
 *  days. Gated by ADMIN_TOKEN header just like feedback. */

app.http("event-summary", {
  methods: ["GET", "OPTIONS"],
  route: "event/summary",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    };
    if (req.method === "OPTIONS") return { status: 204, headers: cors };
    const token = req.headers.get("x-admin-token") ?? new URL(req.url).searchParams.get("token") ?? "";
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      return { status: 401, headers: cors, jsonBody: { error: "unauthorized" } };
    }

    const days = Math.max(1, Math.min(30, parseInt(new URL(req.url).searchParams.get("days") ?? "7", 10)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const table = eventsTable();

    // Collect counts by name, unique devices, per-game start/complete.
    const byName = new Map<string, number>();
    const devices = new Set<string>();
    const gameStarts = new Map<string, number>();
    const gameCompletes = new Map<string, number>();
    const gameQuits = new Map<string, number>();
    const recent: Record<string, unknown>[] = [];

    try {
      for await (const e of table.listEntities()) {
        const ts = String(e.ts ?? "");
        if (ts && new Date(ts) < since) continue;
        const name = String(e.name ?? "");
        byName.set(name, (byName.get(name) ?? 0) + 1);
        if (e.deviceId) devices.add(String(e.deviceId));
        let props: Record<string, unknown> = {};
        try { props = JSON.parse(String(e.props ?? "{}")); } catch {}
        const gid = typeof props.gameId === "string" ? props.gameId : undefined;
        if (gid) {
          if (name === "game_started") gameStarts.set(gid, (gameStarts.get(gid) ?? 0) + 1);
          if (name === "game_completed") gameCompletes.set(gid, (gameCompletes.get(gid) ?? 0) + 1);
          if (name === "game_quit") gameQuits.set(gid, (gameQuits.get(gid) ?? 0) + 1);
        }
        if (recent.length < 200) recent.push({ ...e, props });
      }
    } catch {}

    return {
      status: 200,
      headers: cors,
      jsonBody: {
        days,
        uniqueDevices: devices.size,
        totalEvents: Array.from(byName.values()).reduce((a, b) => a + b, 0),
        byName: Object.fromEntries(byName),
        gameStarts: Object.fromEntries(gameStarts),
        gameCompletes: Object.fromEntries(gameCompletes),
        gameQuits: Object.fromEntries(gameQuits),
        recent,
      },
    };
  },
});

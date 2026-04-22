import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { feedbackTable } from "../shared/tables";

/** POST /api/feedback — append a feedback entry to the feedback table.
 *  GET /api/feedback — admin-only list (requires x-admin-token header).
 *
 *  Anonymous write, admin read. The write path doesn't require any
 *  secrets so the client can POST directly; the read path is gated on
 *  an opaque token matched against the ADMIN_TOKEN app setting. */

const ADMIN_TOKEN = () => process.env.ADMIN_TOKEN ?? "";

app.http("feedback", {
  methods: ["POST", "GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
    if (req.method === "OPTIONS") return { status: 204, headers: cors };

    const table = feedbackTable();
    await table.createTable().catch(() => {}); // idempotent

    if (req.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        return { status: 400, headers: cors, jsonBody: { error: "bad json" } };
      }
      const message = String(body.message ?? "").trim();
      if (!message) return { status: 400, headers: cors, jsonBody: { error: "empty message" } };
      if (message.length > 4000) return { status: 413, headers: cors, jsonBody: { error: "too long" } };

      const id = String(body.id ?? Date.now().toString(36));
      const entity = {
        partitionKey: "feedback",
        rowKey: new Date().toISOString().replace(/[:.]/g, "-") + "_" + id,
        message,
        email: String(body.email ?? "").slice(0, 200),
        route: String(body.route ?? ""),
        userAgent: String(body.userAgent ?? "").slice(0, 500),
        createdAt: new Date().toISOString(),
        ip: req.headers.get("x-forwarded-for") ?? "",
      };
      await table.createEntity(entity);
      ctx.log("feedback stored", entity.rowKey);
      return { status: 200, headers: cors, jsonBody: { ok: true } };
    }

    // GET — admin list
    const token = req.headers.get("x-admin-token") ?? new URL(req.url).searchParams.get("token") ?? "";
    if (!ADMIN_TOKEN() || token !== ADMIN_TOKEN()) {
      return { status: 401, headers: cors, jsonBody: { error: "unauthorized" } };
    }
    const items: Record<string, unknown>[] = [];
    for await (const entity of table.listEntities()) {
      items.push(entity as Record<string, unknown>);
      if (items.length >= 500) break;
    }
    // newest first
    items.sort((a, b) => String(b.rowKey).localeCompare(String(a.rowKey)));
    return { status: 200, headers: cors, jsonBody: { items } };
  },
});

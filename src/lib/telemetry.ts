/** Telemetry — deliberately small surface area so we can stay
 *  disciplined about what we track. Two sinks:
 *
 *   1. Azure Application Insights (connection string in
 *      NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING). Gives us the
 *      built-in dashboards, funnels, retention, and per-event queries
 *      via KQL. Default no-op when the env var isn't set.
 *
 *   2. /api/event — optional Azure Function that tees the same events
 *      into an Azure Storage Table the admin page reads. Fire-and-
 *      forget, failures ignored.
 *
 *  Events are batched and flushed on sendBeacon-friendly boundaries
 *  (5s, visibilityChange, or batch size 20) so we don't slam the
 *  network on every action. */

export type EventName =
  | "page_view"
  | "game_opened"
  | "game_started"
  | "game_completed"
  | "game_quit"
  | "pro_gate_seen"
  | "pro_unlocked"
  | "dating_gate_seen"
  | "dating_unlocked"
  | "feedback_submitted"
  | "search_query"
  | "filter_applied"
  | "tab_switched";

export interface TelemetryEvent {
  name: EventName;
  props?: Record<string, string | number | boolean | undefined>;
  ts: string;
  deviceId: string;
  route: string;
}

const DEVICE_KEY = "salongames:device:v1";
const BATCH_MAX = 20;
const FLUSH_MS = 5000;

let queue: TelemetryEvent[] = [];
let flushTimer: number | null = null;
let initialized = false;

// Lazy-loaded App Insights SDK — only pulled in when we actually have
// a connection string so the shared bundle doesn't grow for users
// without telemetry enabled.
let appInsights: { trackEvent: (e: { name: string; properties?: Record<string, unknown> }) => void } | null = null;

function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const cur = window.localStorage.getItem(DEVICE_KEY);
    if (cur) return cur;
    const id = "d_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "noprefs";
  }
}

async function ensureAppInsights(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (typeof window === "undefined") return;
  const conn = process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING;
  if (!conn) return;
  try {
    const mod = await import("@microsoft/applicationinsights-web");
    const ai = new mod.ApplicationInsights({
      config: {
        connectionString: conn,
        enableAutoRouteTracking: true,
        disableFetchTracking: false,
        disableCookiesUsage: true,
      },
    });
    ai.loadAppInsights();
    ai.trackPageView();
    appInsights = ai as unknown as typeof appInsights;
  } catch {
    // package not installed → silently disable the sink
  }
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  if (typeof window === "undefined") return;
  flushTimer = window.setTimeout(flush, FLUSH_MS);
}

function flush(): void {
  if (flushTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  // Best-effort POST. If the endpoint doesn't exist yet, the 404 is ignored.
  try {
    const body = JSON.stringify({ events: batch });
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/event", blob);
    } else {
      fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // drop batch silently
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", () => flush());
}

export function track(name: EventName, props?: TelemetryEvent["props"]): void {
  if (typeof window === "undefined") return;
  const evt: TelemetryEvent = {
    name,
    props,
    ts: new Date().toISOString(),
    deviceId: getDeviceId(),
    route: window.location.pathname,
  };
  queue.push(evt);
  // Fire to App Insights synchronously (its own batching handles load).
  ensureAppInsights();
  if (appInsights) {
    try {
      appInsights.trackEvent({ name, properties: { ...props, deviceId: evt.deviceId, route: evt.route } });
    } catch {}
  }
  if (queue.length >= BATCH_MAX) flush();
  else scheduleFlush();
}

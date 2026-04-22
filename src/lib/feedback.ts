/** Feedback client. POSTs to /api/feedback (Azure Function on SWA);
 *  falls back to localStorage when the endpoint isn't wired or fails,
 *  so feedback isn't lost before the backend exists.
 *
 *  Local cache is also useful for the admin page: in single-device
 *  admin-only mode, we can surface what *this* device submitted. When
 *  the backend is live, the admin page reads from the server list. */

const LOCAL_KEY = "salongames:feedback:outbox:v1";
const ENDPOINT = "/api/feedback";

export interface FeedbackEntry {
  id: string;
  message: string;
  email?: string;
  route: string;
  userAgent: string;
  createdAt: string;
  /** "sent" once the server accepted; "queued" if local-only. */
  status: "sent" | "queued";
}

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function loadLocalFeedback(): FeedbackEntry[] {
  return safeGet<FeedbackEntry[]>(LOCAL_KEY, []);
}

function appendLocal(entry: FeedbackEntry): void {
  const cur = loadLocalFeedback();
  safeSet(LOCAL_KEY, [entry, ...cur].slice(0, 200));
}

function makeId(): string {
  return "fb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function submitFeedback(message: string, email?: string): Promise<FeedbackEntry> {
  const entry: FeedbackEntry = {
    id: makeId(),
    message: message.trim(),
    email: email?.trim() || undefined,
    route: typeof window !== "undefined" ? window.location.pathname : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    createdAt: new Date().toISOString(),
    status: "queued",
  };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (res.ok) entry.status = "sent";
  } catch {
    // swallow — we keep the local queue copy either way
  }
  appendLocal(entry);
  return entry;
}

"use client";

import { useEffect, useState } from "react";
import { MessageSquare, X, Check } from "lucide-react";
import { submitFeedback } from "@/lib/feedback";

/** Floating feedback button (bottom-right) + modal. Persistent across
 *  every page via the root layout. Posts to /api/feedback; if the
 *  endpoint isn't wired yet, the submission is still captured locally
 *  so nothing is lost. */

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const close = () => {
    setOpen(false);
    // Reset after close animation has time to complete.
    setTimeout(() => {
      setMessage("");
      setEmail("");
      setSent(false);
    }, 200);
  };

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    await submitFeedback(message, email);
    setSending(false);
    setSent(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-bg/90 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted shadow-lg backdrop-blur transition-colors hover:border-[hsl(var(--ember)/0.6)] hover:text-fg"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="mx-auto w-full max-w-md rounded-lg border border-[hsl(var(--ember)/0.4)] bg-bg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">
                  We&apos;re listening
                </p>
                <h2 className="mt-2 font-display text-2xl italic">Tell us what&apos;s broken or missing.</h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close feedback"
                className="rounded-md p-1 text-muted hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {sent ? (
              <div className="mt-6 rounded-md border border-[hsl(var(--ember)/0.5)] bg-[hsl(var(--ember)/0.08)] p-4 text-center">
                <Check className="mx-auto h-5 w-5 text-[hsl(var(--ember))]" />
                <p className="mt-2 font-display text-xl italic text-[hsl(var(--ember))]">Got it.</p>
                <p className="mt-1 text-xs text-muted">Thanks — it goes straight to the notebook.</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 w-full rounded-md border border-border py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-fg"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="What went wrong? What would you love? Anything…"
                  maxLength={2000}
                  className="mt-4 w-full resize-none rounded-md border border-border bg-bg/40 p-3 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional, if you want a reply)"
                  className="mt-2 w-full rounded-md border border-border bg-bg/40 px-3 py-2 font-mono text-xs text-fg placeholder:text-muted/60 focus:border-[hsl(var(--ember)/0.5)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!message.trim() || sending}
                  className="mt-4 w-full rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
                <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  Nothing tracked except what you type.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

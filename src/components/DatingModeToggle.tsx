"use client";

import { useEffect, useState } from "react";
import { loadDatingState, setDatingMode } from "@/lib/persistence";
import { GAMES } from "@/games/registry";

/** Dating Mode toggle with 18+ age gate. First time the user enables
 *  it, they see a confirmation modal. After confirmation, the state is
 *  remembered and they can toggle freely. */

export function DatingModeToggle() {
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    const st = loadDatingState();
    setEnabled(st.enabled);
    setHydrated(true);
  }, []);

  const adultCount = GAMES.filter((g) => g.adultOnly).length;

  const onToggle = () => {
    if (!enabled) {
      const st = loadDatingState();
      if (!st.confirmedAt) {
        setShowGate(true);
        return;
      }
      setDatingMode(true);
      setEnabled(true);
    } else {
      setDatingMode(false);
      setEnabled(false);
    }
  };

  const confirm = () => {
    setDatingMode(true);
    setEnabled(true);
    setShowGate(false);
    // Reload so the catalog filter picks up the new state.
    if (typeof window !== "undefined") window.location.reload();
  };

  if (!hydrated) return null;

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
          enabled
            ? "border-[hsl(var(--ember))] bg-[hsl(var(--ember)/0.15)] text-[hsl(var(--ember))]"
            : "border-border bg-bg/40 text-muted hover:text-fg"
        }`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${enabled ? "bg-[hsl(var(--ember))]" : "bg-muted"}`} />
        Dating mode: {enabled ? "on" : "off"}
      </button>

      {showGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-md rounded-lg border border-[hsl(var(--ember)/0.5)] bg-bg p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--ember))]">18+ content</p>
            <h2 className="mt-2 font-display text-3xl italic">A quick confirmation.</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Dating Mode unlocks {adultCount} adult-only prompt packs — intimate questions, spicy Truth or Dare, late-night Never Have I Ever. Nothing explicit, but written for adults on dates or couples at home.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              By turning it on you confirm you&apos;re 18 or older. You can turn it off any time.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowGate(false)}
                className="rounded-md border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                className="rounded-md bg-[hsl(var(--ember))] py-3 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90"
              >
                I&apos;m 18+ · Turn on
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

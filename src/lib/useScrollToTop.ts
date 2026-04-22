"use client";

import { useEffect } from "react";

/** Scroll the window to the top when the passed dependency changes.
 *  Games call this on phase transitions so tall screens (role
 *  reveals, voting screens) don't strand the user mid-scroll. */
export function useScrollToTop(dep: unknown): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [dep]);
}

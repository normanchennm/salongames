"use client";

import { useEffect } from "react";

/** Registers the service worker at /sw.js. Mounted once from the
 *  root layout. On dev we skip registration because it caches the
 *  HMR chunks and makes iteration miserable; prod only. */

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("SW register failed:", e);
    });
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";
import { primeNarrator } from "@/lib/narrator";

/** One-shot hook that "primes" the shared narrator Audio element
 *  on the first user pointer/key event in the session.
 *
 *  Why: iOS Safari and strict Chrome autoplay policies tie audio-
 *  playback permission to a specific Audio element that was touched
 *  inside a user gesture. Without priming, only the first cue right-
 *  after-a-tap plays; everything auto-advanced after that (ONWW
 *  narrator sequence, Celebrity's 10-seconds-left, Hangman's wrong-
 *  letter ping, etc.) silently rejects.
 *
 *  By listening globally on the first pointerdown / keydown we prime
 *  once-and-for-all and every later `playCue` in the session works
 *  without needing its own tap. `{ once: true }` on both listeners
 *  means this has no ongoing performance cost. */

export function NarratorPrimer() {
  useEffect(() => {
    const prime = () => {
      primeNarrator();
    };
    // `capture: true` so we fire before anything that might
    // stopPropagation. `once: true` so the listener removes itself.
    const opts: AddEventListenerOptions = { once: true, capture: true, passive: true };
    window.addEventListener("pointerdown", prime, opts);
    window.addEventListener("keydown", prime, opts);
    return () => {
      // In case the component unmounts before the user interacts
      // (SPA navigation edge case), detach. Once fired, the browser
      // has already removed them via the `once` option.
      window.removeEventListener("pointerdown", prime, opts);
      window.removeEventListener("keydown", prime, opts);
    };
  }, []);
  return null;
}

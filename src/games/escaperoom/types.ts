/** Escape room content types.
 *
 *  A Room is a linear (mostly) sequence of Scenes. Each Scene has an
 *  ambient background, prose, and one Puzzle the player must solve to
 *  advance. Puzzles come in a small vocabulary; new ones can be added
 *  as new Puzzle variants.
 *
 *  Art pipeline: `image` is a path relative to /public. When a scene
 *  has no image (or the file is missing), we render a gradient
 *  placeholder with the scene title. This lets us ship the engine and
 *  story before any art exists, then swap generated scenes in per-file
 *  without changing content code. */

export type Puzzle =
  | {
      kind: "code";
      /** The prompt shown above the input, e.g. "What time does the clock really show?" */
      prompt: string;
      /** Accepted answers, case-insensitive. Whitespace trimmed. */
      answers: string[];
      /** Short hint shown after the player asks for one. */
      hint?: string;
      /** Placeholder text for the input. */
      placeholder?: string;
      /** Short prose shown on solve, before advancing. */
      solvedText?: string;
    }
  | {
      kind: "choice";
      prompt: string;
      options: { label: string; correct?: boolean; wrongText?: string }[];
      hint?: string;
      solvedText?: string;
    }
  | {
      kind: "observe";
      /** "Pick N things worth noting." */
      prompt: string;
      n: number;
      options: { label: string; correct?: boolean }[];
      hint?: string;
      solvedText?: string;
    };

export interface Scene {
  id: string;
  title: string;
  /** Narrative prose shown at the top of the scene, above the puzzle. */
  prose: string;
  /** Optional path to a /public/escaperoom/<room>/<scene>.jpg asset. */
  image?: string;
  /** Color pair for the placeholder gradient when no image is present. */
  gradient: [string, string];
  puzzle: Puzzle;
  /** Optional short beat shown on scene entry after prose, e.g. a line
   *  of dialogue or a clue line. */
  clue?: string;
}

export interface Room {
  id: string;
  name: string;
  tagline: string;
  tone: "light" | "heavy";
  intro: string;
  outro: string;
  scenes: Scene[];
}

import type { Room } from "../types";

/** "The Antiquarian" — narrative-light puzzle room.
 *
 *  Tone: cursed-object-of-the-month. Heavy on atmosphere, light on
 *  dialogue. Each scene is a self-contained visual puzzle. Story is
 *  thin glue between rooms. 4 scenes, ~15 minutes. */

export const antiquarian: Room = {
  id: "antiquarian",
  name: "The Antiquarian",
  tagline: "Locked in a cursed antique shop at midnight.",
  tone: "light",
  intro:
    "You came in at closing to pick up a wrapped parcel. You remember hearing the door bolt behind you — and then nothing. The shop is dark. Your phone has one bar. The owner left a note on the counter.",
  outro:
    "The bell above the door rings as you step out into wet pavement. Behind you the shop windows are dark and unremarkable. Your parcel is tucked under your arm, heavier than it should be.",
  scenes: [
    {
      id: "front",
      title: "The Front Counter",
      gradient: ["#2a1a10", "#0f0a07"],
      image: "/escaperoom/antiquarian/front.jpg",
      prose:
        "The counter is cluttered with ledgers and the smell of old leather. A note in spidery handwriting reads: \"Back in the morning. The front key is hidden exactly where the old man kept it — somewhere the sun always touched.\"",
      clue: "You remember: at dusk, the sun came through the east window and fell across the welcome mat.",
      puzzle: {
        kind: "choice",
        prompt: "Where is the key?",
        options: [
          { label: "Inside the cash register", wrongText: "The drawer slides open. Empty except for a dead moth." },
          { label: "Under the welcome mat", correct: true },
          { label: "Behind the clock on the wall", wrongText: "You lift the clock. Only dust outlines." },
          { label: "In the umbrella stand", wrongText: "Nothing but an old walking stick." },
        ],
        hint: "The note said \"where the sun always touched.\" Think about where a morning sun falls.",
        solvedText:
          "The brass key is cold and dull. The front door refuses to open — of course. But the inner door to the back rooms clicks softly.",
      },
    },
    {
      id: "clockroom",
      title: "The Clockroom",
      gradient: ["#3a1a1a", "#0f0a07"],
      image: "/escaperoom/antiquarian/clockroom.jpg",
      prose:
        "A narrow room lined with pendulum clocks, all stopped. Only one is running — a tall grandfather with a cracked glass face. Its hands read 2:45. Above it, in gilt: \"THE TRUTH RUNS BACKWARD HERE.\"",
      clue:
        "You notice the second hand is moving counter-clockwise. A small brass plate beneath the clock is a keypad — four digits.",
      puzzle: {
        kind: "code",
        prompt: "What time is it, really? (HHMM)",
        answers: ["9:15", "915", "0915", "9 15", "nine fifteen"],
        placeholder: "e.g. 3:47",
        hint: "If the hands are moving backward, read the clock as if reflected. 2:45 on a mirrored clock shows…",
        solvedText:
          "The keypad sinks inward. Behind you, a bookcase on the far wall exhales a quiet click and shifts half an inch.",
      },
    },
    {
      id: "library",
      title: "The Library Behind the Bookcase",
      gradient: ["#1a2a1a", "#0f0a07"],
      image: "/escaperoom/antiquarian/library.jpg",
      prose:
        "You squeeze through. A small library — no windows, one chair, a reading lamp burning low. Four books are set apart on a lectern: each has a single number painted on its spine in red. 3, 7, 4, 9. A brass dial with a four-digit window sits on the lectern.",
      clue:
        "Slipped inside the chair cushion, a torn card: \"ONLY THOSE THAT COME AFTER A PRIME COUNT.\"",
      puzzle: {
        kind: "code",
        prompt: "Enter the four digits, in order, using only those that come AFTER a prime.",
        answers: ["489", "4 8 9", "4,8,9"],
        placeholder: "e.g. 123",
        hint: "Primes among 3, 7, 4, 9 are 3 and 7. \"After\" each means +1.",
        solvedText:
          "The dial whirs. From under the lectern, a drawer slides open with the parcel you came for — and something else.",
      },
    },
    {
      id: "mirror",
      title: "The Mirror in the Drawer",
      gradient: ["#1a1a2a", "#0f0a07"],
      image: "/escaperoom/antiquarian/mirror.jpg",
      prose:
        "The drawer holds your parcel and a small oval mirror with a tarnished silver frame. When you lift it, your reflection mouths a question: \"Who do you refuse to forgive?\" Four names rise in the glass. You recognize the last one.",
      puzzle: {
        kind: "choice",
        prompt: "Whose name do you say?",
        options: [
          { label: "A stranger who wronged you", wrongText: "The mirror darkens. \"Easy names do not open doors.\"" },
          { label: "A friend who betrayed you", wrongText: "The mirror cools. \"You have already forgiven them. You know this.\"" },
          { label: "A family member", wrongText: "The mirror clouds. \"Family is a long story. Try again.\"" },
          { label: "Yourself", correct: true },
        ],
        hint: "The mirror is showing your reflection. Who does the reflection always refuse first?",
        solvedText:
          "The mirror goes clear. The shop's front door, somewhere far behind you, unbolts itself.",
      },
    },
  ],
};

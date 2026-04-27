/** Map of Us prompts — each turn the app suggests a *kind* of place
 *  to pin. Players are free to skip and add anything; the prompts
 *  give the list shape. Three buckets: where you've been (memory),
 *  where you go (current), where you're going (future). */

export interface PinPrompt { id: string; bucket: "past" | "present" | "future"; question: string; placeholder: string; }

export const PROMPTS: PinPrompt[] = [
  // --- past
  { id: "first-met",     bucket: "past",    question: "Where did we first meet?", placeholder: "the room, the corner, the address — even if it's a chain coffee shop" },
  { id: "first-trip",    bucket: "past",    question: "The first trip we took together.", placeholder: "city, motel, weird detour you still talk about" },
  { id: "wrong-turn",    bucket: "past",    question: "A wrong turn that became a story.", placeholder: "the place we ended up by mistake" },
  { id: "rough-day",     bucket: "past",    question: "Where one of us had a rough day and the other showed up.", placeholder: "the corner, the platform, the parking lot" },
  { id: "third-date",    bucket: "past",    question: "The third-date place that locked it in.", placeholder: "venue, dish, what was playing" },

  // --- present
  { id: "ours",          bucket: "present", question: "A place that's ours.", placeholder: "café, park bench, walk we keep walking" },
  { id: "ritual",        bucket: "present", question: "Where we go on autopilot together.", placeholder: "Sunday morning, after-work, the in-between" },
  { id: "comfort",       bucket: "present", question: "A place that's reliable when one of us is off.", placeholder: "couch, restaurant, walking route" },
  { id: "celebration",   bucket: "present", question: "Where we celebrate the small wins.", placeholder: "the booth at the back, the corner table" },
  { id: "cheap-date",    bucket: "present", question: "Our $0–$20 date spot.", placeholder: "library, free museum night, the long bench by the water" },

  // --- future
  { id: "next-trip",     bucket: "future",  question: "The next trip we're going to take.", placeholder: "country / city / road, even tentative" },
  { id: "dream-spot",    bucket: "future",  question: "A place we'd cross an ocean for.", placeholder: "the one that keeps coming up" },
  { id: "milestone-loc", bucket: "future",  question: "Where we'd want to celebrate a milestone.", placeholder: "specific or vibe-only — both fine" },
  { id: "live-someday",  bucket: "future",  question: "A place we've talked about living someday.", placeholder: "neighborhood, country, climate" },
  { id: "small-soon",    bucket: "future",  question: "A small new spot we'll try this month.", placeholder: "concrete enough to actually do" },
];

export const TURN_ORDER: string[] = PROMPTS.map((p) => p.id);

export function promptAt(turn: number): PinPrompt {
  const id = TURN_ORDER[turn % TURN_ORDER.length];
  return PROMPTS.find((p) => p.id === id)!;
}

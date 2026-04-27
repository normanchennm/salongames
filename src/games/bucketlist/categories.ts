/** Bucket List Bingo categories. Each turn the app suggests a
 *  category — players are free to skip and add anything, but the
 *  prompt narrows the field and prevents "I can't think of one." */

export interface Category { id: string; label: string; placeholder: string; }

export const CATEGORIES: Category[] = [
  { id: "travel",    label: "Travel",     placeholder: "A place we'd cross an ocean for…" },
  { id: "food",      label: "Food",       placeholder: "A dish we want to learn to cook…" },
  { id: "milestone", label: "Milestone",  placeholder: "Something we'd circle on a calendar…" },
  { id: "skill",     label: "Skill",      placeholder: "Something we'd both want to be good at…" },
  { id: "ritual",    label: "Ritual",     placeholder: "Something we want to do every year…" },
  { id: "outdoor",   label: "Outdoor",    placeholder: "A trail, peak, body of water, or coast…" },
  { id: "creative",  label: "Creative",   placeholder: "Something we'd make, write, or build…" },
  { id: "small",     label: "Small but Specific", placeholder: "A perfect ordinary day we want again…" },
  { id: "stretch",   label: "Stretch",    placeholder: "Something that feels too big to say out loud…" },
  { id: "soon",      label: "Soon",       placeholder: "Something we could do this month…" },
];

/** Aron-ish ladder of categories — start light, escalate, end on the
 *  one that's harder to say. Order matters; the game cycles through. */
export const TURN_ORDER: string[] = [
  "small", "food", "outdoor", "travel", "ritual",
  "skill", "creative", "milestone", "soon", "stretch",
];

export function categoryAt(turn: number): Category {
  const id = TURN_ORDER[turn % TURN_ORDER.length];
  return CATEGORIES.find((c) => c.id === id)!;
}

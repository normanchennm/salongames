/** Five Love Languages — paired-question quiz adapted from Gary
 *  Chapman's framework. Each question presents two options; the user
 *  picks one. Each option maps to one of five tags:
 *    W — Words of Affirmation
 *    Q — Quality Time
 *    G — Receiving Gifts
 *    A — Acts of Service
 *    T — Physical Touch (we use a softer "Closeness" framing in copy)
 *
 *  Twenty questions; each pair compares two of the five tags. Even
 *  weight: every pair appears twice across the quiz. */

export type LangTag = "W" | "Q" | "G" | "A" | "T";

export const LANG_LABELS: Record<LangTag, { name: string; subtitle: string }> = {
  W: { name: "Words of Affirmation", subtitle: "Spoken or written reassurance, recognition, naming things out loud." },
  Q: { name: "Quality Time",         subtitle: "Undivided attention. The phone face-down kind." },
  G: { name: "Gifts",                subtitle: "Tokens that say 'I was thinking about you.'" },
  A: { name: "Acts of Service",      subtitle: "Small things done quietly that make life lighter." },
  T: { name: "Closeness",            subtitle: "Hand on the shoulder, side-by-side on the couch, the language of proximity." },
};

export interface QuizQ { a: { text: string; tag: LangTag }; b: { text: string; tag: LangTag }; }

export const QUIZ: QuizQ[] = [
  // W vs Q
  { a: { text: "An unexpected note from them about something I did well.", tag: "W" }, b: { text: "An evening with their phone in another room.", tag: "Q" } },
  { a: { text: "Hearing them brag about me to a friend.",                    tag: "W" }, b: { text: "A walk together with no agenda.",                          tag: "Q" } },
  // W vs G
  { a: { text: "A long heartfelt voice memo.",                                tag: "W" }, b: { text: "A small gift they picked because it 'felt like me.'",     tag: "G" } },
  { a: { text: "Being told 'I'm proud of you' in front of someone else.",    tag: "W" }, b: { text: "Coming home to a small surprise on the counter.",          tag: "G" } },
  // W vs A
  { a: { text: "A specific compliment about something I usually overlook.", tag: "W" }, b: { text: "Them quietly handling the chore I keep avoiding.",          tag: "A" } },
  { a: { text: "Reassurance during a hard week — said, not just felt.",     tag: "W" }, b: { text: "Coffee made and waiting before I'm fully awake.",          tag: "A" } },
  // W vs T
  { a: { text: "A morning text that lands at the right time.",              tag: "W" }, b: { text: "A long hug as I'm walking out the door.",                  tag: "T" } },
  // Q vs G
  { a: { text: "Cooking dinner together with no rush.",                     tag: "Q" }, b: { text: "A book they bought because it's 'so you.'",                tag: "G" } },
  { a: { text: "Two hours of doing nothing in the same room.",              tag: "Q" }, b: { text: "Flowers at the door for no reason.",                       tag: "G" } },
  // Q vs A
  { a: { text: "An unhurried meal across from each other.",                 tag: "Q" }, b: { text: "Them taking the car in so I don't have to.",                tag: "A" } },
  { a: { text: "Them sitting with me through something boring.",            tag: "Q" }, b: { text: "Them making the call I've been dreading.",                  tag: "A" } },
  // Q vs T
  { a: { text: "A quiet morning, no phones, just present.",                 tag: "Q" }, b: { text: "Sleeping in on a Saturday with no plans.",                  tag: "T" } },
  { a: { text: "An evening walk where we actually talk.",                   tag: "Q" }, b: { text: "Sitting next to each other on the couch, leaning in.",     tag: "T" } },
  // G vs A
  { a: { text: "A small thing they got me when traveling without me.",      tag: "G" }, b: { text: "Coming home to find the dishwasher already unloaded.",     tag: "A" } },
  { a: { text: "A sweet note + one specific gift I wouldn't buy myself.",   tag: "G" }, b: { text: "Them taking the kid / dog / errand off my plate today.",  tag: "A" } },
  // G vs T
  { a: { text: "An unexpected snack waiting for me after a long day.",      tag: "G" }, b: { text: "An unprompted forehead kiss on the way past.",              tag: "T" } },
  // A vs T
  { a: { text: "Them refilling my water glass without me asking.",          tag: "A" }, b: { text: "Them sitting beside me with a hand on my back.",           tag: "T" } },
  { a: { text: "Knowing one of my open-loops will be closed by tonight.",   tag: "A" }, b: { text: "Falling asleep with my head on their shoulder.",            tag: "T" } },
  // mixed final pair
  { a: { text: "A 'thinking of you' text in the middle of a Tuesday.",      tag: "W" }, b: { text: "A surprise drink dropped off at my desk.",                  tag: "G" } },
  { a: { text: "Sitting beside me while I work — no conversation needed.",  tag: "Q" }, b: { text: "Them quietly fixing the thing I gave up on.",                tag: "A" } },
];

export function score(answers: ("a" | "b" | null)[]): Record<LangTag, number> {
  const tally: Record<LangTag, number> = { W: 0, Q: 0, G: 0, A: 0, T: 0 };
  answers.forEach((ans, i) => {
    if (!ans) return;
    const q = QUIZ[i];
    if (!q) return;
    tally[ans === "a" ? q.a.tag : q.b.tag] += 1;
  });
  return tally;
}

export function topTwo(t: Record<LangTag, number>): LangTag[] {
  return (Object.keys(t) as LangTag[]).sort((x, y) => t[y] - t[x]).slice(0, 2);
}

export const SUGGESTIONS: Partial<Record<`${LangTag}->${LangTag}`, string>> = {
  "W->A": "This week: leave a sticky note for the chore they always do, name it specifically, thank them.",
  "A->W": "This week: say it out loud once when they handle something — 'I noticed, and I'm grateful.'",
  "Q->T": "This week: 20 phone-down minutes on the couch. No agenda, no second screen.",
  "T->Q": "This week: an evening walk where the only goal is talking — leave the dog, leave the route.",
  "Q->G": "This week: a small thoughtful gift PLUS a slow meal — pick the meal first, the gift can be tiny.",
  "G->Q": "This week: skip the gift, plan a 90-minute window where you're both just… there.",
  "W->G": "This week: pair the gift with a one-line note. A sentence that names what it's for.",
  "G->W": "This week: text a specific reason they're easy to love, before you wrap anything.",
  "T->A": "This week: a small chore, done quietly, and a hand on their back when you walk past.",
  "A->T": "This week: do the chore. Then sit next to them when you're done.",
  "W->Q": "This week: send the message — but also block 60 minutes for it to land in person.",
  "Q->W": "This week: during the next quiet evening, name one thing you've been quietly admiring.",
  "W->T": "This week: written affection in the morning, physical affection at night. Same day.",
  "T->W": "This week: tell them what your hand-on-their-back means in words. Once is enough.",
  "G->A": "This week: skip the gift; do the thing they keep half-mentioning that hasn't been done yet.",
  "A->G": "This week: do the thing AND leave a small thing on the counter. Both don't have to be expensive.",
  "G->T": "This week: instead of a gift, plan a slow evening of being close, full stop.",
  "T->G": "This week: a small physical token they can carry — same idea, different channel.",
};

export function suggestion(top: LangTag, partnerTop: LangTag): string {
  if (top === partnerTop) return `You both lead with ${LANG_LABELS[top].name}. Lean in — your defaults match. Pick one specific thing this week to do for them in their language and watch what happens.`;
  return SUGGESTIONS[`${top}->${partnerTop}`] ?? `This week: pick one small specific thing to do for them in the language of ${LANG_LABELS[partnerTop].name}.`;
}

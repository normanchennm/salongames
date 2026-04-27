/** Charades for Two — couples-flavored prompt deck. Mix of:
 *   - shared-domestic things (the dishwasher we agreed to load this way)
 *   - inside-joke triggers (a generic situation most couples have)
 *   - light romance / dating-life vignettes
 *   - relatable "your partner is doing this" moments
 *  No celebrities or movies — those exist in the regular Charades game. */

export interface Prompt { category: "domestic" | "moment" | "feeling" | "habit"; text: string; }

export const PROMPTS: Prompt[] = [
  // domestic
  { category: "domestic", text: "Loading the dishwasher 'wrong'" },
  { category: "domestic", text: "Folding a fitted sheet" },
  { category: "domestic", text: "Killing a spider in the bathroom" },
  { category: "domestic", text: "Trying to assemble IKEA furniture together" },
  { category: "domestic", text: "Getting locked out and patting every pocket" },
  { category: "domestic", text: "Cooking with the wrong knife on purpose" },
  { category: "domestic", text: "Making coffee at 6am with one eye open" },
  { category: "domestic", text: "Carrying way too many groceries from the car" },
  { category: "domestic", text: "Trying to open a vacuum-sealed jar" },
  { category: "domestic", text: "Deciding what to cook for dinner together" },
  { category: "domestic", text: "Realizing you forgot to start the laundry" },

  // moment
  { category: "moment", text: "First-date awkward small talk" },
  { category: "moment", text: "Trying to look interested in their friend's story" },
  { category: "moment", text: "Pretending to like a gift" },
  { category: "moment", text: "The moment you realize you forgot the anniversary" },
  { category: "moment", text: "Sneaking into bed late so they don't wake up" },
  { category: "moment", text: "Trying to whisper-fight in front of guests" },
  { category: "moment", text: "Being introduced to the parents" },
  { category: "moment", text: "Reading a text aloud and trying to interpret the tone" },
  { category: "moment", text: "Apologizing without actually saying sorry" },
  { category: "moment", text: "Long road-trip silence at 11pm" },
  { category: "moment", text: "Watching a horror movie and pretending you're fine" },
  { category: "moment", text: "Walking dramatically in the rain together" },

  // feeling
  { category: "feeling", text: "Hangry — pre-snack" },
  { category: "feeling", text: "Pretending not to be jealous" },
  { category: "feeling", text: "Thinking of the perfect comeback an hour later" },
  { category: "feeling", text: "Realizing you said something wrong" },
  { category: "feeling", text: "Being roasted by your in-laws" },
  { category: "feeling", text: "Trying not to cry at a movie" },
  { category: "feeling", text: "Defending your bad music taste" },
  { category: "feeling", text: "Smelling something burning in the kitchen" },

  // habit
  { category: "habit", text: "Snoozing the alarm three times" },
  { category: "habit", text: "Eating the leftovers you said you wouldn't eat" },
  { category: "habit", text: "Looking at your phone instead of going to bed" },
  { category: "habit", text: "Stealing covers in your sleep" },
  { category: "habit", text: "Brushing teeth and walking around the house" },
  { category: "habit", text: "Singing in the shower badly" },
  { category: "habit", text: "Talking to your pet in a baby voice" },
  { category: "habit", text: "Refilling the same water bottle for the fifth time" },
];

export function pickFrom(seen: Set<string>): Prompt {
  const remaining = PROMPTS.filter((p) => !seen.has(p.text));
  const pool = remaining.length > 0 ? remaining : PROMPTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

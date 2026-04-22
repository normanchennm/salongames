/** Fibbage prompts — real factual trivia where the truth is so weird
 *  that a bluffer's made-up answer might actually pass as real.
 *  Each prompt has exactly one real answer; players write fake ones
 *  that aim to fool the table. Table picks what they think is true.
 *
 *  Scoring (standard Fibbage):
 *   - +1000 if you picked the real answer
 *   - +500 per player you fooled with your bluff
 *
 *  Free pack: 40 prompts. Keep them factually TRUE + verifiable —
 *  bugs in prompts become bugs in gameplay ("I swear that's wrong"). */

export interface FibPrompt {
  /** The question shown to all players. Fill-in-the-blank style. */
  question: string;
  /** The actual true answer. Kept server-side so bluffers don't see it. */
  truth: string;
  /** Aliases the scoring engine should count as "right" if a player's
   *  bluff happens to match the real answer (rare but it happens). */
  aliases?: string[];
}

export const FIB_PROMPTS: FibPrompt[] = [
  { question: "In 1965, Swedish chef Per Sjöström was hospitalized after attempting to juggle six ___ at a state dinner.",
    truth: "live eels" },
  { question: "The average human produces enough saliva in a lifetime to fill about ___ swimming pools.",
    truth: "two" },
  { question: "In 1924, a man named Fred Ott was the first person to be filmed ___ .",
    truth: "sneezing", aliases: ["sneeze"] },
  { question: "The official state toy of Pennsylvania is the ___ .",
    truth: "Slinky" },
  { question: "In medieval Europe, people believed carrying a ___ would cure headaches.",
    truth: "dead mole" },
  { question: "The world's largest pumpkin weighed over ___ pounds in 2023.",
    truth: "2700" },
  { question: "In Ancient Rome, urine was used as a form of ___ .",
    truth: "mouthwash" },
  { question: "Scientists have discovered a species of ant that can explode itself as a defense mechanism, called the ___ ant.",
    truth: "kamikaze" },
  { question: "Sloths can take up to ___ days to digest a single meal.",
    truth: "30" },
  { question: "The inventor of the frisbee was ___ after he died.",
    truth: "turned into a frisbee" },
  { question: "A group of flamingos is called a ___ .",
    truth: "flamboyance" },
  { question: "In Finland, you can get fined for speeding based on your ___ .",
    truth: "income" },
  { question: "The Eiffel Tower can grow up to ___ inches taller on hot days.",
    truth: "6" },
  { question: "Scientists have found that cows have best friends and get stressed when ___ .",
    truth: "separated from them" },
  { question: "The shortest commercial flight in the world is ___ seconds long.",
    truth: "57" },
  { question: "Octopuses have ___ hearts.",
    truth: "three" },
  { question: "A baby puffin is called a ___ .",
    truth: "puffling" },
  { question: "In 1518, an entire town in France suffered a plague where hundreds of people ___ for days.",
    truth: "danced" },
  { question: "The loudest animal on Earth, relative to size, is the ___ .",
    truth: "pistol shrimp" },
  { question: "Every year, the town of Buñol, Spain hosts a festival where people throw ___ at each other.",
    truth: "tomatoes" },
  { question: "The first product ever scanned with a barcode was a pack of ___ .",
    truth: "Wrigley's gum" },
  { question: "A day on Venus is longer than a ___ on Venus.",
    truth: "year" },
  { question: "Bananas are slightly ___ .",
    truth: "radioactive" },
  { question: "The unicorn is the national animal of ___ .",
    truth: "Scotland" },
  { question: "Honey found in Egyptian tombs is still ___ after thousands of years.",
    truth: "edible" },
  { question: "A ___ has more bones than an adult human.",
    truth: "newborn baby" },
  { question: "In 1838, a man in New Jersey successfully sued his neighbor for ___ .",
    truth: "being a witch" },
  { question: "The world record for longest hiccup fit lasted ___ years.",
    truth: "68" },
  { question: "A group of owls is called a ___ .",
    truth: "parliament" },
  { question: "Cleopatra lived closer in time to the invention of the ___ than to the building of the pyramids.",
    truth: "iPhone" },
  { question: "The Mona Lisa is painted on ___ .",
    truth: "a poplar wood panel" },
  { question: "A single strand of spaghetti is called a ___ .",
    truth: "spaghetto" },
  { question: "Armadillos always give birth to ___ identical babies.",
    truth: "four" },
  { question: "In 1999, the country of Bhutan banned ___ for being corrupting to culture.",
    truth: "television", aliases: ["TV"] },
  { question: "The dot over a lowercase 'i' is called a ___ .",
    truth: "tittle" },
  { question: "Cows have been observed to produce more milk when they listen to ___ music.",
    truth: "slow" },
  { question: "A single cloud can weigh over ___ tons.",
    truth: "a million" },
  { question: "The fear of long words is ironically called ___ .",
    truth: "hippopotomonstrosesquippedaliophobia" },
  { question: "In 1923, a jockey named Frank Hayes won a horse race while ___ .",
    truth: "dead" },
  { question: "The average pencil can draw a line approximately ___ miles long.",
    truth: "35" },
];

export function pickPrompts(n: number): FibPrompt[] {
  const pool = FIB_PROMPTS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

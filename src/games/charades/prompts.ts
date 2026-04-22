/** Charades prompt pack. Mix of movies, people, idioms, actions,
 *  and objects — organized by "category" tag so we can render the
 *  category hint with the prompt (makes guessing easier without
 *  giving it away). Premium drop will add themed packs (Pixar only,
 *  sports, 80s music, etc.). */

export interface Prompt {
  category: "movie" | "person" | "action" | "object" | "phrase" | "animal";
  text: string;
}

export const PROMPTS: Prompt[] = [
  // Movies
  { category: "movie", text: "The Matrix" },
  { category: "movie", text: "Jaws" },
  { category: "movie", text: "Titanic" },
  { category: "movie", text: "The Godfather" },
  { category: "movie", text: "Star Wars" },
  { category: "movie", text: "Harry Potter" },
  { category: "movie", text: "The Lion King" },
  { category: "movie", text: "Finding Nemo" },
  { category: "movie", text: "Frozen" },
  { category: "movie", text: "Jurassic Park" },
  { category: "movie", text: "Ghostbusters" },
  { category: "movie", text: "Home Alone" },
  { category: "movie", text: "The Shining" },
  { category: "movie", text: "Indiana Jones" },
  { category: "movie", text: "The Avengers" },
  { category: "movie", text: "Forrest Gump" },
  { category: "movie", text: "Pulp Fiction" },
  { category: "movie", text: "Back to the Future" },
  // People
  { category: "person", text: "Taylor Swift" },
  { category: "person", text: "Elon Musk" },
  { category: "person", text: "Beyoncé" },
  { category: "person", text: "Michael Jordan" },
  { category: "person", text: "Shakespeare" },
  { category: "person", text: "Lady Gaga" },
  { category: "person", text: "LeBron James" },
  { category: "person", text: "Oprah Winfrey" },
  // Actions
  { category: "action", text: "riding a bicycle" },
  { category: "action", text: "making pizza" },
  { category: "action", text: "milking a cow" },
  { category: "action", text: "changing a diaper" },
  { category: "action", text: "surfing" },
  { category: "action", text: "playing golf" },
  { category: "action", text: "fishing" },
  { category: "action", text: "climbing a ladder" },
  { category: "action", text: "juggling" },
  { category: "action", text: "skydiving" },
  // Objects
  { category: "object", text: "a vacuum cleaner" },
  { category: "object", text: "a toaster" },
  { category: "object", text: "a chainsaw" },
  { category: "object", text: "a pogo stick" },
  { category: "object", text: "a microscope" },
  { category: "object", text: "a seatbelt" },
  // Phrases
  { category: "phrase", text: "the early bird gets the worm" },
  { category: "phrase", text: "break a leg" },
  { category: "phrase", text: "raining cats and dogs" },
  { category: "phrase", text: "spill the beans" },
  { category: "phrase", text: "piece of cake" },
  { category: "phrase", text: "bite the bullet" },
  { category: "phrase", text: "cold feet" },
  // Animals
  { category: "animal", text: "penguin" },
  { category: "animal", text: "kangaroo" },
  { category: "animal", text: "octopus" },
  { category: "animal", text: "flamingo" },
  { category: "animal", text: "giraffe" },
  { category: "animal", text: "sloth" },
  { category: "animal", text: "elephant" },
  { category: "animal", text: "chameleon" },
];

export function randomPrompt(excludeTexts: Set<string>): Prompt {
  const pool = PROMPTS.filter((p) => !excludeTexts.has(p.text));
  if (pool.length === 0) return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

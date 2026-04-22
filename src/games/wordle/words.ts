/** Small curated 5-letter word list for the Wordle-clone.
 *  Not an exhaustive dictionary — picked for recognizability and
 *  a reasonable difficulty distribution. Expand freely. */

export const WORDLE_WORDS = [
  "crane","slate","arise","audio","cloud","spike","trick","flame","grown","plant",
  "light","broom","night","sheet","storm","brain","pride","bloom","dread","flint",
  "quiet","honor","shift","grant","value","fable","pinch","crisp","vault","heart",
  "realm","rowdy","cruel","feast","maybe","cabin","whale","knife","wrist","moral",
  "tiger","brisk","swarm","coast","rough","snail","grape","bliss","stone","flint",
  "drift","angle","crest","tribe","fable","blond","chord","mirth","giant","plush",
  "clerk","brave","flock","swift","crown","elbow","piano","mound","shore","vivid",
  "pouch","skull","patio","smoke","charm","bland","venue","agent","drama","royal",
  "glove","chase","blame","dodge","fleck","wager","noisy","sleek","chime","dairy",
  "wreck","lucky","gloom","query","spoil","scour","witch","prism","hymn ","mount",
  "plead","stork","feast","cliff","grind","truss","stomp","blunt","crank","vouch",
  "feign","shard","weary","glint","humor","realm","gulch","mason","bloat","curdy",
];

// Filter out anything malformed just in case (defensive).
export const WORDLE_POOL = WORDLE_WORDS
  .map((w) => w.trim().toLowerCase())
  .filter((w) => /^[a-z]{5}$/.test(w));

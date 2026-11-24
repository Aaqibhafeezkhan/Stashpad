// Pure JavaScript BM25 ranking. Dependency-free, computed on each search (no index on disk).
const K1 = 1.2;
const B = 0.75;

// Lowercase words of two or more letters or digits. Unicode aware, so Dutch works too.
// Chinese, Japanese and Korean are written without spaces, so a whole sentence would be one "word".
// Runs of those scripts are split into overlapping pairs of characters (bigrams), the usual way
// search engines handle them without a dictionary.
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu;

// A language name written with a symbol: letters directly followed by + or #.
const NAMED = /^\p{L}+[+#]+$/u;
const SYMBOLS = /[+#]+/gu;
// A single capital letter standing alone names a language or tool (R, C, K).
const STANDALONE = /^(?![AI]$)\p{Lu}$/u;

export function tokenize(text) {
  const tokens = [];
  const folded = text.normalize("NFD").replace(/(\p{Script=Latin})\p{M}+/gu, "$1").normalize("NFC");
  for (const chunk of folded.split(/[^\p{L}\p{N}+#]+/u)) {
    if (chunk === "") continue;
    let raws;
    if (chunk.includes("+") || chunk.includes("#")) {
      // Keep C++, C# and F# whole: the split above drops the symbol and would leave a
      // one-letter word. A symbol that is not glued to a word ("a + b") still separates.
      if (NAMED.test(chunk)) {
        tokens.push(chunk.toLowerCase());
        continue;
      }
      raws = chunk.replace(SYMBOLS, " ").split(" ");
    } else {
      raws = [chunk];
    }
    for (const raw of raws) {
      if (raw === "") continue;
      // Split an identifier at camel boundaries BEFORE lowercasing and keep the
      // whole identifier too, so "user profile" and getUserProfile both find it.
      // Only pieces with a lower-to-upper boundary are split: applying the
      // acronym rule to title-case words would turn "SQLite" into sq + lite.
      const parts = /(?<=\p{Ll})(?=\p{Lu})/u.test(raw)
        ? raw.replace(/(?<=\p{Ll})(?=\p{Lu})/gu, " ")
             .replace(/(?<=\p{Lu})(?=\p{Lu}\p{Ll})/gu, " ").split(" ").filter(Boolean)
        : [raw];
      const whole = raw.toLowerCase();
      if (parts.length > 1 && whole.length >= 2) tokens.push(whole);
      for (const part of parts) {
        const piece = part.toLowerCase();
        if (piece === "") continue;
        if (!CJK.test(piece)) {
          if (piece.length >= 2) tokens.push(piece);
          // A single capital letter standing alone is a name such as R; lowercase
          // "a" and "i" are ordinary words, so STANDALONE leaves them out.
          else if (raw.length === 1 && STANDALONE.test(raw)) tokens.push(piece);
          continue;
        }
        CJK.lastIndex = 0;
        const rest = piece.replace(CJK, " ").split(" ").filter((w) => w.length >= 2);
        tokens.push(...rest);
        for (const run of piece.match(CJK)) {
          const chars = [...run];
          if (chars.length === 1) tokens.push(run);
          for (let i = 0; i + 1 < chars.length; i += 1) tokens.push(chars[i] + chars[i + 1]);
        }
        CJK.lastIndex = 0;
      }
    }
  }
  return tokens;
}

// Light folding, so "tools" finds "tool", "testing" finds "test" and "deployed" finds "deploy".
// It is deliberately small: it is not a full stemmer, and it is applied to both query and text.
// A verb ending folds only when the base left behind still looks like a word: it must carry
// a vowel (so "thing", "string" and "sing" keep themselves), a doubled consonant is undone
// only for the letters doubling takes in real verbs (so "falling" stays "fall", not "fal"),
// and a trailing "e" the ending swallowed comes back for a short base ("making" ->
// "make", "used" -> "use"), for one ending in "re" ("agreed" -> "agree"), or for a
// four-letter base with a single vowel ending in one consonant ("staging" -> "stage",
// "writing" -> "write", "closing" -> "close"). Without that last case the fold leaves
// behind a different real word ("stag"), which then false-hits on that word. Forms the
// rules cannot reach ("dancing"/"dance", "tried"/"try") stay misses rather than false hits.
const VOWEL = /[aeiou]/;
const DOUBLE_UNDO = new Set(["b", "d", "g", "m", "n", "p", "r", "t"]);

function foldVerbEnding(token, ending) {
  const base = token.slice(0, -ending.length);
  if (!VOWEL.test(base)) return token;
  const last = base.at(-1);
  const doubled = base.length >= 2 && base.at(-2) === last;
  if (doubled && DOUBLE_UNDO.has(last) && base.length >= 4) return base.slice(0, -1);
  if (ending === "ed" && base.endsWith("ce")) return token;
  if (ending === "ed" && base.endsWith("re") && base.length >= 4) return `${base}e`;
  // Four letters, one vowel, one final consonant: the ending swallowed the "e"
  // ("stag" -> "stage"). A base with two vowels ("head") or a consonant cluster
  // at the end ("warn", "sing", "rang") keeps itself.
  if (
    base.length === 4 &&
    /[aeiou][^aeiou]$/.test(base) &&
    (base.match(/[aeiou]/g) ?? []).length === 1
  ) {
    return `${base}e`;
  }
  if (base.length >= 4) return base;
  if (doubled) return token;
  if (base.length === 3 && (last === "x" || last === "z")) return base;
  if (base.length === 3 && !VOWEL.test(last) && last !== "s") return `${base}e`;
  if (base.length === 2 && !VOWEL.test(last)) return `${base}e`;
  return token;
}

export function stem(token) {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  // Drop the plural first, then fold a verb ending on what is left, so the
  // singular and the plural of an -ing/-ed word meet ("warnings" -> "warning" ->
  // "warn"). Folding first would leave "warnings" at "warning" while "warning"
  // folds to "warn". The plural rules run here and the verb fold below, never
  // the other way round.
  let base = token;
  if (token.length >= 4 && token.endsWith("sses")) base = token.slice(0, -2);
  else if (token.length >= 4 && token.endsWith("shes")) base = token.slice(0, -2);
  // "-ches": "watches" -> "watch", but "caches" -> "cache". Strip "es" only when
  // the "ch" follows a consonant; after a vowel the "e" belongs to the word.
  else if (token.length >= 4 && token.endsWith("ches")) {
    const beforeCh = token.length >= 5 ? token.at(-5) : "";
    base = VOWEL.test(beforeCh) ? token.slice(0, -1) : token.slice(0, -2);
  }
  // "-xes": "boxes" -> "box", but "axes" -> "axe". Strip "es" only when a word of
  // three or more letters is left behind.
  else if (token.length >= 4 && token.endsWith("xes")) {
    base = token.length - 2 >= 3 ? token.slice(0, -2) : token.slice(0, -1);
  }
  // A single "s" is the plain plural ("horses" -> "horse"); "ss" words keep
  // themselves ("class", "pass").
  else if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    base = token.slice(0, -1);
  }
  if (base.length > 4 && base.endsWith("ing")) return foldVerbEnding(base, "ing");
  if (base.length > 3 && base.endsWith("ed")) return foldVerbEnding(base, "ed");
  return base;
}

function termsOf(text) {
  return tokenize(text).map(stem);
}

// Meaningful words for comparing two memories: stemmed, and at least four letters long.
export function keyTerms(text) {
  return termsOf(text).filter((term) => term.length >= 4);
}

// docs: [{ id, text }]. Returns [{ id, score }] for documents that match at least one term,
// best match first. Ties are ordered by id so results are stable.
// Options: synonyms (Map term -> Set of terms) and synonymWeight. A synonym counts at that weight.
export function bm25Rank(docs, query, { synonyms = null, synonymWeight = 0.5 } = {}) {
  const queryTerms = [...new Set(termsOf(query))];
  if (queryTerms.length === 0) return [];
  const weights = new Map(queryTerms.map((term) => [term, 1]));
  if (synonyms !== null) {
    for (const term of queryTerms) {
      for (const other of synonyms.get(term) ?? []) {
        if (!weights.has(other)) weights.set(other, synonymWeight);
      }
    }
  }

  const tokenized = docs.map((doc) => termsOf(doc.text));
  const count = docs.length;
  const totalLength = tokenized.reduce((sum, tokens) => sum + tokens.length, 0);
  const avgLength = count > 0 && totalLength > 0 ? totalLength / count : 1;

  const documentFrequency = new Map();
  for (const tokens of tokenized) {
    for (const term of new Set(tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const results = [];
  docs.forEach((doc, index) => {
    const tokens = tokenized[index];
    const frequencies = new Map();
    for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);

    let score = 0;
    const matched = [];
    for (const [term, weight] of weights) {
      const frequency = frequencies.get(term) ?? 0;
      if (frequency === 0) continue;
      matched.push(weight === 1 ? term : `${term} (synonym)`);
      const df = documentFrequency.get(term);
      const idf = Math.log(1 + (count - df + 0.5) / (df + 0.5));
      const lengthNorm = 1 - B + (B * tokens.length) / avgLength;
      score += (weight * idf * frequency * (K1 + 1)) / (frequency + K1 * lengthNorm);
    }

    if (score > 0) results.push({ id: doc.id, score, matched });
  });

  return results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

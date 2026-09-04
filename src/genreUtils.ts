/**
 * Genre Tag Normalization and Semicolon Delimiter Utilities
 * 
 * In digital audio software (ID3v2, Vorbis Comments, Rekordbox, Traktor,
 * Serato, MusicBee, Foobar2000, mp3tag), the semicolon followed by a single space ('; ')
 * is the de facto tag-delimiting standard for multi-value genre metadata.
 */

// Recognized acronyms and special casing for musical subgenres
const KNOWN_ACRONYMS = new Set([
  "EDM", "IDM", "UK", "UKG", "DJ", "OST", "BPM", "VIP", "FM", "EP", "LP", "USA", "US", "NYC", "LA"
]);

const CANONICAL_GENRES: Record<string, string> = {
  "r&b": "R&B",
  "r & b": "R&B",
  "dnb": "DnB",
  "d&b": "D&B",
  "drum & bass": "Drum & Bass",
  "drum and bass": "Drum & Bass",
  "hip hop": "Hip-Hop",
  "hip-hop": "Hip-Hop",
  "trip hop": "Trip-Hop",
  "trip-hop": "Trip-Hop",
  "lo fi": "Lo-Fi",
  "lo-fi": "Lo-Fi",
  "lofi": "Lo-Fi",
  "hi nrg": "Hi-NRG",
  "hi-nrg": "Hi-NRG",
  "hinrg": "Hi-NRG",
  "nu disco": "Nu-Disco",
  "nu-disco": "Nu-Disco",
  "post punk": "Post-Punk",
  "post-punk": "Post-Punk",
  "post rock": "Post-Rock",
  "post-rock": "Post-Rock",
  "synth pop": "Synth-Pop",
  "synth-pop": "Synth-Pop",
  "synthwave": "Synthwave",
  "neo soul": "Neo-Soul",
  "neo-soul": "Neo-Soul",
  "psy trance": "Psy-Trance",
  "psy-trance": "Psy-Trance",
  "psytrance": "Psy-Trance",
  "g funk": "G-Funk",
  "g-funk": "G-Funk",
  "k-pop": "K-Pop",
  "kpop": "K-Pop",
  "j-pop": "J-Pop",
  "jpop": "J-Pop",
  "rock 'n' roll": "Rock 'n' Roll",
  "rock n roll": "Rock 'n' Roll",
  "afro house": "Afro House",
  "deep house": "Deep House",
  "tech house": "Tech House",
  "progressive house": "Progressive House",
  "melodic techno": "Melodic Techno",
  "hard techno": "Hard Techno",
  "peak time": "Peak Time",
  "minimal techno": "Minimal Techno",
  "indie dance": "Indie Dance",
  "future bass": "Future Bass"
};

// Minor conjunctions/prepositions that stay lowercase unless first/last word
const MINOR_WORDS = new Set(["and", "of", "the", "in", "on", "at", "to", "for", "de", "la", "van", "von", "der"]);

/**
 * Capitalizes a single genre tag uniformly (Title Case with musical acronym preservation)
 */
export function formatSingleGenreTitle(tag: string): string {
  if (!tag) return "";
  const cleaned = tag.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!cleaned) return "";

  const lower = cleaned.toLowerCase();
  if (CANONICAL_GENRES[lower]) {
    return CANONICAL_GENRES[lower];
  }

  // Handle hyphenated components like "Post-Punk", "Trip-Hop"
  const processHyphenatedPart = (word: string): string => {
    if (word.includes("-")) {
      return word
        .split("-")
        .map(subWord => processWord(subWord))
        .join("-");
    }
    return processWord(word);
  };

  // Capitalize individual word according to music title standards
  const processWord = (w: string, isFirstWord = false): string => {
    const trimmed = w.trim();
    if (!trimmed) return "";
    const cleanLower = trimmed.toLowerCase();

    // Check acronym
    const upperClean = trimmed.toUpperCase();
    if (KNOWN_ACRONYMS.has(upperClean)) {
      return upperClean;
    }

    if (!isFirstWord && MINOR_WORDS.has(cleanLower)) {
      return cleanLower;
    }

    // Preserve parenthetical starts e.g. "(Peak Time)"
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(1, -1);
      return `(${formatSingleGenreTitle(inner)})`;
    }

    // Standard word capitalization
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  };

  // Tokenize by space while preserving parentheses
  const words = cleaned.split(/\s+/);
  const formattedWords = words.map((word, idx) => {
    return processHyphenatedPart(word);
  });

  return formattedWords.join(" ");
}

/**
 * Splits any raw genre string by known delimiters (;, /, \, |, comma)
 * and normalizes all tags to Title Case separated strictly by '; ' (semicolon + space).
 */
export function normalizeGenreTags(raw: string | null | undefined): string {
  if (!raw) return "";

  // Split on semicolons, slashes, backslashes, pipes, or commas
  // Note: We do NOT split on hyphens or ampersands within genre names (e.g. "Hip-Hop", "Drum & Bass")
  const rawTags = raw
    .split(/[;\\/|,]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (rawTags.length === 0) return "";

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of rawTags) {
    const formatted = formatSingleGenreTitle(tag);
    if (!formatted) continue;

    const lowerKey = formatted.toLowerCase();
    if (!seen.has(lowerKey)) {
      seen.add(lowerKey);
      normalized.push(formatted);
    }
  }

  // Join strictly with semicolon followed by space
  return normalized.join("; ");
}

/**
 * Merges multiple genre sources (e.g. original tag and AI recommended tag),
 * deduplicating tags case-insensitively and returning a single string
 * formatted strictly with '; ' delimiters and Title Case capitalization.
 */
export function mergeGenreTags(...genreInputs: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const allFormattedTags: string[] = [];

  for (const input of genreInputs) {
    if (!input) continue;
    
    // Split input on standard delimiters
    const tokens = input
      .split(/[;\\/|,]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    for (const token of tokens) {
      const formatted = formatSingleGenreTitle(token);
      if (!formatted) continue;

      const lowerKey = formatted.toLowerCase();
      if (!seen.has(lowerKey)) {
        seen.add(lowerKey);
        allFormattedTags.push(formatted);
      }
    }
  }

  return allFormattedTags.join("; ");
}

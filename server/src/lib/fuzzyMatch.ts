import Fuse from "fuse.js";
import type { MenuItem } from "../data/menu";

export interface MatchCandidate {
  raw: string;
  resolvedId: string;
  label: string;
  score: number; // Fuse score (0 exact, 1 worst)
  confidence: number; // 0..1 (1-best)
  spanStart: number;
  spanEnd: number; // exclusive
}

export interface ResolveResult {
  resolvedText: string;
  matches: MatchCandidate[];
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^\w\s-]/g, "");
}

/**
 * Resolve menu-like spans in the input text using Fuse.js.
 * Returns both the resolved text and a list of match candidates with scores/confidence.
 */
export function resolveMenuMatchesWithScores(
  text: string,
  menuItems: MenuItem[],
): ResolveResult {
  const words = text.split(/\s+/);
  const matchedIndices = new Set<number>();
  let resolvedText = text;
  const matches: MatchCandidate[] = [];

  // Build Fuse index over candidate keys (name and id)
  const fuse = new Fuse(menuItems, {
    keys: ["name", "id"],
    includeScore: true,
    threshold: 0.6,
    ignoreLocation: true,
    useExtendedSearch: false,
  });

  // Words we will never auto-resolve via fuzzy match (too generic or out-of-domain)
  const FUZZY_BLACKLIST = new Set([
    "cola",
    "pizza",
    "fries",
    "tacos",
    "coke",
    "pepsi",
    "soda",
  ]);

  // Common stopwords that should never be resolved to menu items
  const STOPWORDS = new Set([
    "add",
    "want",
    "please",
    "i",
    "would",
    "like",
    "get",
    "a",
    "an",
    "the",
    "to",
    "my",
    "for",
    "with",
    "and",
    "of",
  ]);

  // ngram scan (4..1) to prefer longer spans
  for (let n = 4; n >= 1; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      let overlap = false;
      for (let k = i; k < i + n; k++) if (matchedIndices.has(k)) overlap = true;
      if (overlap) continue;

      const ngram = words.slice(i, i + n).join(" ");
      const normalizedNgram = normalize(ngram);
      if (normalizedNgram.length < 2) continue;

      if (STOPWORDS.has(normalizedNgram)) continue;

      // Explicit alias / exact matching first (deterministic)
      let aliasMatched = false;
      for (const item of menuItems) {
        if (!item.aliases || item.aliases.length === 0) continue;
        for (const a of item.aliases) {
          if (normalize(a) === normalizedNgram) {
            const escaped = ngram.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "i");
            if (!regex.test(resolvedText)) continue;
            resolvedText = resolvedText.replace(regex, item.id);
            for (let k = i; k < i + n; k++) matchedIndices.add(k);
            matches.push({
              raw: ngram,
              resolvedId: item.id,
              label: item.name,
              score: 0,
              confidence: 1,
              spanStart: i,
              spanEnd: i + n,
            });
            aliasMatched = true;
            break;
          }
        }
        if (aliasMatched) break;
      }
      if (aliasMatched) continue;

      // Reject clearly out-of-domain short tokens
      if (FUZZY_BLACKLIST.has(normalizedNgram)) continue;

      const results = fuse.search(normalizedNgram, { limit: 3 });
      if (!results || results.length === 0) continue;

      // Choose best candidate deterministically: lowest score, then by id
      results.sort((a, b) => {
        if (a.score! < b.score!) return -1;
        if (a.score! > b.score!) return 1;
        return a.item.id.localeCompare(b.item.id);
      });

      const best = results[0];
      if (!best) continue;

      // Convert Fuse score (0..1) to confidence (1 - score), clamp
      const score = typeof best.score === "number" ? best.score : 1;
      const confidence = Math.max(0, Math.min(1, 1 - score));

      // Stricter minimum confidence thresholds to avoid semantic guessing
      const minConfidence = normalizedNgram.length <= 2 ? 0.95 : 0.8;
      if (confidence < minConfidence) continue;

      const item = best.item;

      // Replace in resolvedText using word boundaries for the original ngram
      const escaped = ngram.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "i");
      if (!regex.test(resolvedText)) continue;

      resolvedText = resolvedText.replace(regex, item.id);
      for (let k = i; k < i + n; k++) matchedIndices.add(k);

      matches.push({
        raw: ngram,
        resolvedId: item.id,
        label: item.name,
        score,
        confidence,
        spanStart: i,
        spanEnd: i + n,
      });
    }
  }

  return { resolvedText, matches };
}

// Backwards-compatible wrapper
export function resolveMenuMatches(
  text: string,
  menuItems: MenuItem[],
): string {
  return resolveMenuMatchesWithScores(text, menuItems).resolvedText;
}

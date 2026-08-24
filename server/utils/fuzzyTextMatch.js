/**
 * Forgiving text match for admin search (menu items, ingredients).
 * Supports partial typing, missing letters, and minor typos.
 */

export function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function searchTokensFromQuery(query) {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, prevDiag + cost);
      prevDiag = temp;
    }
  }
  return prev[b.length];
}

function maxEditDistance(token) {
  const len = token.length;
  if (len <= 2) return 0;
  if (len <= 4) return 1;
  if (len <= 7) return 2;
  return 3;
}

function fuzzyTokenMatchesCandidate(token, candidate) {
  if (!token || !candidate) return false;
  if (candidate.includes(token)) return true;
  if (token.length >= 3 && candidate.startsWith(token)) return true;

  const limit = maxEditDistance(token);
  if (limit === 0) return token === candidate;

  if (Math.abs(token.length - candidate.length) > limit) return false;
  return levenshtein(token, candidate) <= limit;
}

function wordsFromText(text) {
  return normalizeSearchText(text).split(" ").filter(Boolean);
}

/**
 * True when every query token fuzzily matches the target text
 * (full string, compact form, or individual words).
 */
export function fuzzyTextMatchesQuery(text, query) {
  const normalizedText = normalizeSearchText(text);
  const tokens = searchTokensFromQuery(query);
  if (!tokens.length) return false;

  const words = wordsFromText(normalizedText);
  const compactText = normalizedText.replace(/\s/g, "");

  return tokens.every((token) => {
    if (normalizedText.includes(token)) return true;
    if (compactText.includes(token)) return true;
    if (words.some((word) => fuzzyTokenMatchesCandidate(token, word))) {
      return true;
    }
    if (
      token.length >= 4 &&
      fuzzyTokenMatchesCandidate(token, compactText)
    ) {
      return true;
    }
    return false;
  });
}

export { levenshtein, maxEditDistance, fuzzyTokenMatchesCandidate };

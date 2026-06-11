const NON_LATIN_SCRIPT = /[\p{Script=Han}\p{Script=Devanagari}\p{Script=Arabic}\p{Script=Bengali}\p{Script=Cyrillic}]/u;

export const normalizeIntentText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const scoreExactIntent = (text, terms) => {
  const normalized = normalizeIntentText(text);
  if (!normalized) return 0;

  const queryTokens = normalized.split(" ").filter(Boolean);
  const paddedQuery = ` ${normalized} `;
  let best = 0;

  for (const term of terms.filter(Boolean)) {
    const candidate = normalizeIntentText(term);
    if (!candidate) continue;

    const candidateTokens = candidate.split(" ").filter(Boolean);
    const nonLatin = NON_LATIN_SCRIPT.test(candidate);
    const phraseMatch = nonLatin
      ? normalized.includes(candidate)
      : paddedQuery.includes(` ${candidate} `);
    const stemMatch =
      nonLatin &&
      candidateTokens.length === 1 &&
      candidate.length >= 4 &&
      queryTokens.some((token) => token.startsWith(candidate));

    if (phraseMatch || stemMatch) {
      best = Math.max(best, Math.min(10, 4 + candidateTokens.length));
    }
  }

  return best;
};

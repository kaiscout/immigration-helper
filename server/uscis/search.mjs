import fs from "node:fs";
import { CORPUS_PATH } from "./corpus.mjs";

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "can", "for", "from", "have", "how",
  "immigration", "into", "not", "that", "the", "their", "this", "uscis", "what",
  "when", "where", "which", "who", "will", "with", "would", "you", "your"
]);

function tokens(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function loadCorpus(filePath = CORPUS_PATH) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

export function searchCorpus(records, query, limit = 4) {
  const queryTokens = [...new Set(tokens(query))];
  if (!queryTokens.length) return [];

  return records
    .map((record) => {
      const title = String(record.title || "").toLowerCase();
      const description = String(record.description || "").toLowerCase();
      const body = String(record.text || "").toLowerCase();
      let score = 0;

      for (const token of queryTokens) {
        if (title.includes(token)) score += 8;
        if (description.includes(token)) score += 4;
        if (body.includes(token)) score += 1;
      }

      return { record, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ record }) => ({
      url: record.url,
      title: record.title,
      lastModified: record.lastModified,
      excerpt: (record.chunks?.[0] || record.text || "").slice(0, 1_800)
    }));
}

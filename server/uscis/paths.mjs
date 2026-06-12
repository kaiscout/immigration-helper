import path from "node:path";

export const DATA_DIR = path.resolve("server/data");
export const CORPUS_PATH = path.join(DATA_DIR, "uscis-corpus.jsonl");
export const MANIFEST_PATH = path.join(DATA_DIR, "uscis-manifest.json");
export const PACKAGED_CORPUS_PATH = `${CORPUS_PATH}.gz`;

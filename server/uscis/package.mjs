import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { CORPUS_PATH, PACKAGED_CORPUS_PATH } from "./paths.mjs";

export function packageCorpus() {
  if (!fs.existsSync(CORPUS_PATH)) {
    throw new Error(`Missing ${CORPUS_PATH}. Run npm run uscis:scrape first.`);
  }

  const source = fs.readFileSync(CORPUS_PATH);
  const packaged = zlib.gzipSync(source, { level: 9 });
  fs.mkdirSync(path.dirname(PACKAGED_CORPUS_PATH), { recursive: true });
  fs.writeFileSync(PACKAGED_CORPUS_PATH, packaged);

  return {
    sourcePath: path.relative(process.cwd(), CORPUS_PATH),
    packagedPath: path.relative(process.cwd(), PACKAGED_CORPUS_PATH),
    sourceBytes: source.length,
    packagedBytes: packaged.length
  };
}

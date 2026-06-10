import fs from "node:fs";
import path from "node:path";
import {
  CORPUS_PATH,
  DATA_DIR,
  MANIFEST_PATH,
  PoliteFetcher,
  crawlPage,
  discoverRelevantUrls,
  readExistingCorpus,
  writeCorpus
} from "../server/uscis/corpus.mjs";

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const dryRun = process.argv.includes("--dry-run");
const refresh = process.argv.includes("--refresh");
const limitValue = option("limit");
const limit = limitValue ? Number.parseInt(limitValue, 10) : Number.POSITIVE_INFINITY;
const sitemapDirectory = option("sitemap-dir");

if (!Number.isFinite(limit) && limit !== Number.POSITIVE_INFINITY) {
  throw new Error("--limit must be a positive number.");
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const fetcher = new PoliteFetcher();
console.log("Reading USCIS robots.txt and sitemaps...");
const discovery = await discoverRelevantUrls(fetcher, { sitemapDirectory });

fs.writeFileSync(
  MANIFEST_PATH,
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "https://www.uscis.gov/sitemap.xml",
    pageCount: discovery.pages.length,
    pages: discovery.pages
  }, null, 2)}\n`,
  "utf8"
);

console.log(`Found ${discovery.pages.length} relevant current USCIS HTML pages.`);
console.log(`Manifest: ${path.relative(process.cwd(), MANIFEST_PATH)}`);

if (dryRun) {
  console.log("Dry run complete. No content pages were downloaded.");
  process.exit(0);
}

const records = readExistingCorpus();
const approvedUrls = new Set(discovery.pages.map((page) => page.url));
for (const url of records.keys()) {
  if (!approvedUrls.has(url)) records.delete(url);
}
const pending = discovery.pages.filter((page) => {
  if (refresh) return true;
  const existing = records.get(page.url);
  return !existing || (page.lastModified && existing.lastModified !== page.lastModified);
});
const selected = pending.slice(0, limit);

console.log(
  `Crawling ${selected.length} page(s) with a minimum 10-second delay. ` +
  `${records.size} page(s) are already cached.`
);

let completed = 0;
let failed = 0;
for (const page of selected) {
  try {
    const record = await crawlPage(fetcher, page);
    if (record) {
      records.set(record.url, record);
      writeCorpus(records);
      completed += 1;
      console.log(`[${completed + failed}/${selected.length}] Saved ${record.title}`);
    } else {
      failed += 1;
      console.warn(`[${completed + failed}/${selected.length}] Skipped empty page: ${page.url}`);
    }
  } catch (error) {
    failed += 1;
    console.warn(`[${completed + failed}/${selected.length}] Failed ${page.url}: ${error.message}`);
  }
}

writeCorpus(records, CORPUS_PATH);
console.log(`Done. Saved ${completed}, failed/skipped ${failed}, corpus total ${records.size}.`);

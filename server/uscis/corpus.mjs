import fs from "node:fs";
import path from "node:path";
import { DomUtils, parseDocument } from "htmlparser2";
import {
  USCIS_CRAWL_DELAY_MS,
  USCIS_ORIGIN,
  USCIS_SITEMAP_URL,
  USCIS_USER_AGENT,
  isRelevantUscisUrl,
  normalizeUscisUrl,
  parseRobotsRules
} from "./config.mjs";
import { CORPUS_PATH, DATA_DIR, MANIFEST_PATH } from "./paths.mjs";

export { CORPUS_PATH, DATA_DIR, MANIFEST_PATH };

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class PoliteFetcher {
  constructor(delayMs = USCIS_CRAWL_DELAY_MS) {
    this.delayMs = Math.max(delayMs, USCIS_CRAWL_DELAY_MS);
    this.lastRequestAt = 0;
  }

  async fetch(url, options = {}) {
    const wait = this.delayMs - (Date.now() - this.lastRequestAt);
    if (wait > 0) await sleep(wait);

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "text/html,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": USCIS_USER_AGENT,
        ...(options.headers || {})
      },
      redirect: "follow"
    });
    this.lastRequestAt = Date.now();
    return response;
  }
}

function walk(node, visit) {
  if (!node) return;
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

function findAll(root, predicate) {
  const matches = [];
  walk(root, (node) => {
    if (predicate(node)) matches.push(node);
  });
  return matches;
}

function findFirst(root, predicate) {
  let match = null;
  walk(root, (node) => {
    if (!match && predicate(node)) match = node;
  });
  return match;
}

function nodeNameIs(node, name) {
  return node?.type === "tag" && node.name?.toLowerCase() === name;
}

function xmlLocations(xml) {
  const document = parseDocument(xml, { xmlMode: true });
  return findAll(document, (node) => nodeNameIs(node, "loc"))
    .map((node) => DomUtils.textContent(node).trim())
    .filter(Boolean);
}

export async function discoverRelevantUrls(fetcher, { sitemapDirectory } = {}) {
  let sitemapUrls = [];

  if (sitemapDirectory) {
    sitemapUrls = fs
      .readdirSync(sitemapDirectory)
      .filter((name) => /^uscis-sitemap-\d+\.xml$/.test(name))
      .sort()
      .map((name) => path.join(sitemapDirectory, name));
  } else {
    const indexResponse = await fetcher.fetch(USCIS_SITEMAP_URL);
    if (!indexResponse.ok) {
      throw new Error(`USCIS sitemap request failed with HTTP ${indexResponse.status}.`);
    }
    sitemapUrls = xmlLocations(await indexResponse.text());
  }

  const robotsResponse = await fetcher.fetch(`${USCIS_ORIGIN}/robots.txt`);
  if (!robotsResponse.ok) {
    throw new Error(`USCIS robots.txt request failed with HTTP ${robotsResponse.status}.`);
  }
  const robotsDisallows = parseRobotsRules(await robotsResponse.text());

  const discovered = new Map();
  for (const sitemapUrl of sitemapUrls) {
    let xml;
    if (sitemapDirectory) {
      xml = fs.readFileSync(sitemapUrl, "utf8");
    } else {
      const response = await fetcher.fetch(sitemapUrl);
      if (!response.ok) {
        throw new Error(`USCIS child sitemap request failed with HTTP ${response.status}.`);
      }
      xml = await response.text();
    }

    const document = parseDocument(xml, { xmlMode: true });
    findAll(document, (node) => nodeNameIs(node, "url")).forEach((element) => {
      const locationNode = findFirst(element, (node) => nodeNameIs(node, "loc"));
      const modifiedNode = findFirst(element, (node) => nodeNameIs(node, "lastmod"));
      const location = locationNode ? DomUtils.textContent(locationNode).trim() : "";
      const lastModified = modifiedNode ? DomUtils.textContent(modifiedNode).trim() || null : null;
      if (!isRelevantUscisUrl(location, robotsDisallows)) return;

      const normalized = normalizeUscisUrl(location);
      if (normalized) discovered.set(normalized, { url: normalized, lastModified });
    });
  }

  return {
    robotsDisallows,
    pages: [...discovered.values()].sort((a, b) => a.url.localeCompare(b.url))
  };
}

function cleanText(value) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text, maxLength = 1_800, overlap = 220) {
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if (`${current}\n\n${paragraph}`.length <= maxLength) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }

    chunks.push(current);
    current = `${current.slice(-overlap)}\n\n${paragraph}`;
  }

  if (current) chunks.push(current);
  return chunks;
}

export function extractUscisPage(html, sourceUrl, lastModified = null) {
  const document = parseDocument(html);
  const excludedNames = new Set([
    "footer", "form", "header", "iframe", "nav", "noscript", "script", "style", "svg"
  ]);
  const blockNames = new Set([
    "dd", "div", "dt", "h1", "h2", "h3", "h4", "li", "p", "section", "table", "tr"
  ]);
  const isExcluded = (node) => {
    if (node?.type !== "tag") return false;
    const className = node.attribs?.class || "";
    return excludedNames.has(node.name?.toLowerCase()) ||
      node.attribs?.["aria-hidden"] === "true" ||
      /\b(?:breadcrumb|social-share|usa-skipnav)\b/.test(className);
  };
  const readableText = (node) => {
    if (!node || isExcluded(node)) return "";
    if (node.type === "text") return node.data || "";
    const value = (node.children || []).map(readableText).join("");
    return blockNames.has(node.name?.toLowerCase()) ? `${value}\n\n` : value;
  };
  const contentAttribute = (predicate) =>
    findFirst(document, predicate)?.attribs?.content || "";
  const heading = findFirst(document, (node) => nodeNameIs(node, "h1"));
  const titleNode = findFirst(document, (node) => nodeNameIs(node, "title"));
  const title = cleanText(
    (heading ? DomUtils.textContent(heading) : "") ||
    contentAttribute((node) => nodeNameIs(node, "meta") && node.attribs?.property === "og:title") ||
    (titleNode ? DomUtils.textContent(titleNode) : "")
  );
  const description = cleanText(
    contentAttribute((node) => nodeNameIs(node, "meta") && node.attribs?.name === "description") ||
    contentAttribute((node) => nodeNameIs(node, "meta") && node.attribs?.property === "og:description")
  );
  const main =
    findFirst(document, (node) => nodeNameIs(node, "main")) ||
    findFirst(document, (node) => nodeNameIs(node, "article")) ||
    findFirst(document, (node) => node?.type === "tag" && node.attribs?.id === "main-content") ||
    findFirst(document, (node) => nodeNameIs(node, "body"));

  const text = cleanText(readableText(main));
  if (!title || text.length < 160) return null;

  return {
    url: normalizeUscisUrl(sourceUrl),
    title,
    description,
    lastModified,
    fetchedAt: new Date().toISOString(),
    text,
    chunks: chunkText(text)
  };
}

export function readExistingCorpus(filePath = CORPUS_PATH) {
  if (!fs.existsSync(filePath)) return new Map();

  const records = new Map();
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record?.url) records.set(record.url, record);
    } catch {
      // A partial final line can remain after an interrupted crawl; the next run repairs it.
    }
  }
  return records;
}

export function writeCorpus(records, filePath = CORPUS_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = [...records.values()]
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((record) => JSON.stringify(record))
    .join("\n");
  fs.writeFileSync(filePath, content ? `${content}\n` : "", "utf8");
}

export async function crawlPage(fetcher, page) {
  const response = await fetcher.fetch(page.url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
  }

  return extractUscisPage(await response.text(), page.url, page.lastModified);
}

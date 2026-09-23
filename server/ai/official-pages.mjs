const OFFICIAL_DOMAINS = Object.freeze([
  "uscis.gov", "cbp.gov", "dhs.gov", "state.gov", "justice.gov", "ice.gov", "dol.gov"
]);
const MAX_BYTES = 256 * 1024;
const MAX_TEXT = 8000;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const SKIP_TAGS = new Set([
  "script", "style", "nav", "header", "footer", "noscript", "svg", "form",
  "button", "select", "textarea", "iframe", "template", "head"
]);
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr"
]);
const ENTITIES = Object.freeze({
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", copy: "©", reg: "®", trade: "™",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•",
  euro: "€", pound: "£", ensp: " ", emsp: " ", thinsp: " "
});

function officialUrl(value, base) {
  try {
    if (typeof value !== "string" || !value.trim()) return null;
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
        (url.port && url.port !== "443") ||
        !OFFICIAL_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (original, entity) => {
    if (entity[0] !== "#") return ENTITIES[entity] ?? original;
    const hexadecimal = entity[1]?.toLowerCase() === "x";
    const point = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isInteger(point) || point < 32 || point > 0x10ffff ||
        (point >= 0xd800 && point <= 0xdfff)) return " ";
    return String.fromCodePoint(point);
  });
}

function normalizeText(value) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Deliberately a conservative text extractor, not a browser or HTML executor.
// Hidden chrome and active elements contribute no reference evidence. Malformed
// suppressed markup can discard extra text, rather than leaking script content.
function htmlText(html) {
  const tagPattern = /<!--[\s\S]*?(?:-->|$)|<![^<>]*>|<\/?[a-z][^<>]*>/gi;
  const suppressed = [];
  const parts = [];
  let cursor = 0;
  for (const match of html.matchAll(tagPattern)) {
    if (!suppressed.length) parts.push(html.slice(cursor, match.index));
    const token = match[0];
    const name = /^<\/?([a-z][a-z\d:-]*)/i.exec(token)?.[1]?.toLowerCase();
    if (name) {
      const closing = /^<\//.test(token);
      if (closing) {
        if (suppressed.at(-1) === name) suppressed.pop();
      } else if (!VOID_TAGS.has(name) && !/\/\s*>$/.test(token)) {
        if (SKIP_TAGS.has(name) || /\s(?:hidden(?:\s|=|>)|aria-hidden\s*=\s*["']?true\b)/i.test(token)) {
          suppressed.push(name);
        } else if (suppressed.length && suppressed.at(-1) === name) {
          suppressed.push(name);
        }
      }
      if (!suppressed.length) parts.push(" ");
    }
    cursor = match.index + token.length;
  }
  if (!suppressed.length) parts.push(html.slice(cursor));
  return normalizeText(decodeEntities(parts.join(" "))).slice(0, MAX_TEXT);
}

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason || new Error("Page fetch timed out"));
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason || new Error("Page fetch timed out"));
    signal.addEventListener("abort", aborted, { once: true });
    Promise.resolve(promise).then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", aborted));
  });
}

function cancelBody(body) {
  try { Promise.resolve(body?.cancel()).catch(() => {}); } catch { /* Already closed/locked. */ }
}

async function boundedBody(response, signal) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    cancelBody(response.body);
    return null;
  }
  if (typeof response.body?.getReader !== "function") return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  let completed = false;
  try {
    while (!signal.aborted) {
      const chunk = await abortable(reader.read(), signal);
      if (chunk.done) {
        completed = true;
        return text + decoder.decode();
      }
      if (!(chunk.value instanceof Uint8Array)) return null;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES) return null;
      text += decoder.decode(chunk.value, { stream: true });
    }
    return null;
  } finally {
    if (!completed) {
      try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* Already closed. */ }
    }
    try { reader.releaseLock(); } catch { /* A timed-out read may still be pending. */ }
  }
}

async function fetchPage(requestedUrl, fetchImpl, signal) {
  let currentUrl = requestedUrl;
  const visited = new Set();
  for (let redirects = 0; redirects <= 3 && !signal.aborted; redirects += 1) {
    if (visited.has(currentUrl)) return null;
    visited.add(currentUrl);
    const response = await abortable(fetchImpl(currentUrl, {
      method: "GET", redirect: "manual", credentials: "omit", referrerPolicy: "no-referrer",
      headers: { Accept: "text/html, application/xhtml+xml, text/plain" }, signal
    }), signal);
    // A fetch implementation must honor manual redirects. Never accept content
    // from an uninspected final target, even if its URL happens to be official.
    if (response.url && officialUrl(response.url) !== currentUrl) {
      cancelBody(response.body);
      return null;
    }
    if (REDIRECT_CODES.has(response.status)) {
      const nextUrl = officialUrl(response.headers.get("location"), currentUrl);
      cancelBody(response.body);
      if (!nextUrl || redirects === 3) return null;
      currentUrl = nextUrl;
      continue;
    }
    const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (response.status !== 200 || !["text/html", "application/xhtml+xml", "text/plain"].includes(type)) {
      cancelBody(response.body);
      return null;
    }
    const raw = await boundedBody(response, signal);
    if (raw === null || signal.aborted) return null;
    const isHtml = type !== "text/plain" || /^\s*(?:<!doctype\s+html\b|<html\b)/i.test(raw);
    const text = isHtml ? htmlText(raw) : normalizeText(raw).slice(0, MAX_TEXT);
    if (!text) return null;
    const titleStart = isHtml && /<title\b[^<>]*>/i.exec(raw);
    const titleRemainder = titleStart ? raw.slice(titleStart.index + titleStart[0].length) : "";
    const titleEnd = /<\/title\s*>/i.exec(titleRemainder);
    const title = titleEnd ? normalizeText(decodeEntities(titleRemainder.slice(0, titleEnd.index)
      .replace(/<[^<>]*>/g, " "))).slice(0, 240) : "";
    return {
      url: currentUrl,
      ...(currentUrl !== requestedUrl ? { requestedUrl } : {}),
      ...(title ? { title } : {}),
      text,
      checkedAt: new Date().toISOString()
    };
  }
  return null;
}

// Fetched text is reference material for claim review, never claim approval.
// This has no retries, credentials, paid APIs, browser fallback, or bypasses.
export async function fetchOfficialPages(urls, { fetchImpl = fetch, timeoutMs = 10000, maxPages = 6 } = {}) {
  if (!Array.isArray(urls) || typeof fetchImpl !== "function") return [];
  const limit = Number.isFinite(maxPages) ? Math.min(6, Math.max(0, Math.floor(maxPages))) : 6;
  const duration = Number.isFinite(timeoutMs) ? Math.min(10000, Math.max(0, timeoutMs)) : 10000;
  if (!limit || !duration) return [];
  const candidates = [];
  const seen = new Set();
  for (const value of urls) {
    const url = officialUrl(value);
    if (!url || seen.has(url)) continue;
    candidates.push(url);
    seen.add(url);
    if (candidates.length === limit) break;
  }
  if (!candidates.length) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Official-page deadline exceeded")), duration);
  const pages = new Array(candidates.length);
  let nextIndex = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, async () => {
      while (!controller.signal.aborted && nextIndex < candidates.length) {
        const index = nextIndex++;
        try { pages[index] = await fetchPage(candidates[index], fetchImpl, controller.signal); }
        catch { pages[index] = null; }
      }
    }));
    return pages.filter(Boolean);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

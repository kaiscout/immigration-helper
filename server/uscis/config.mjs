export const USCIS_ORIGIN = "https://www.uscis.gov";
export const USCIS_SITEMAP_URL = `${USCIS_ORIGIN}/sitemap.xml`;
export const USCIS_CRAWL_DELAY_MS = 10_000;
export const USCIS_USER_AGENT =
  "ImmigrationHelperBot/1.0 (+https://kaiscout.github.io/immigration-helper/support.html; admin@immigrationhelper.org)";

const RELEVANT_PREFIXES = [
  "/addresschange",
  "/administrative-appeals",
  "/adoption",
  "/citizenship",
  "/citizenship-resource-center",
  "/family",
  "/file-online",
  "/forms",
  "/green-card",
  "/humanitarian",
  "/laws-and-policy",
  "/military",
  "/policy-manual",
  "/records",
  "/scams-fraud-and-misconduct",
  "/tools",
  "/visit-the-united-states",
  "/visit-the-us",
  "/working-in-the-united-states"
];

const RELEVANT_EXACT_PATHS = new Set([
  "/alerts",
  "/avoid-scams",
  "/case-status",
  "/contactcenter",
  "/employment-authorization"
]);

const EXCLUDED_EXACT_PATHS = new Set([
  "/administrative-appeals/aao-practice-manual/search",
  "/citizenship-resource-center/resources-for-educational-programs/citizenship-teacher-training-registration",
  "/forms/filing-guidance/forms-by-mail-confirmation",
  "/forms/myaccount-redirect",
  "/tools/a-z-index/site-map",
  "/tools/top-ten-ways-uscis-is-improving-the-integrity-of-the-immigration-system"
]);

const RELEVANT_ABOUT_PREFIXES = [
  "/about-us/contact-us",
  "/about-us/find-a-uscis-office"
];

const EXCLUDED_PREFIXES = [
  "/archive",
  "/archive-alerts",
  "/archive-forms-updates",
  "/archive-laws",
  "/archive-reports",
  "/archive-testimonies-and-speeches",
  "/es",
  "/i-9-central",
  "/news",
  "/outreach",
  "/save",
  "/sites",
  "/website-policies"
];

const EXCLUDED_EXTENSIONS = /\.(?:avi|csv|docx?|gif|jpe?g|json|mp3|mp4|pdf|png|pptx?|svg|txt|webp|xlsx?|xml|zip)$/i;

export function normalizeUscisUrl(rawUrl) {
  try {
    const url = new URL(rawUrl, USCIS_ORIGIN);
    if (url.origin !== USCIS_ORIGIN) return null;
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function isRelevantUscisUrl(rawUrl, robotsDisallows = []) {
  const normalized = normalizeUscisUrl(rawUrl);
  if (!normalized) return false;

  const { pathname } = new URL(normalized);
  if (EXCLUDED_EXTENSIONS.test(pathname)) return false;
  if (EXCLUDED_EXACT_PATHS.has(pathname)) return false;
  if (robotsDisallows.some((prefix) => prefix && pathname.startsWith(prefix))) return false;
  if (EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }

  if (RELEVANT_EXACT_PATHS.has(pathname)) return true;
  if (pathname === "/newsroom/alerts" || pathname.startsWith("/newsroom/alerts/")) return true;
  if (RELEVANT_ABOUT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  return RELEVANT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function parseRobotsRules(robotsText) {
  const lines = robotsText.split(/\r?\n/);
  const disallows = [];
  let appliesToAll = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      appliesToAll = value === "*";
    } else if (field === "disallow" && appliesToAll && value.startsWith("/")) {
      disallows.push(value);
    }
  }

  return [...new Set(disallows)];
}

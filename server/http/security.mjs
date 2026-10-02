import { isIP } from "node:net";

const normalizeAddress = (value) => {
  const address = String(value || "").trim().replace(/^\[|\]$/g, "");
  const withoutIpv4Port = address.replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/u, "$1");
  const withoutMappedPrefix = withoutIpv4Port.replace(/^::ffff:/u, "");
  return isIP(withoutMappedPrefix) ? withoutMappedPrefix : "unknown";
};

export function trustedClientAddress(request, { trustForwardedFor = false } = {}) {
  if (trustForwardedFor) {
    const forwarded = request?.headers?.["x-forwarded-for"];
    const first = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || "")
      .split(",")[0]
      .trim();
    const normalized = normalizeAddress(first);
    if (normalized !== "unknown") return normalized;
  }
  return normalizeAddress(request?.socket?.remoteAddress);
}
const normalizeOrigin = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.pathname === "/" && !url.search && !url.hash ? url.origin : "";
  } catch {
    return "";
  }
};

export function createCorsPolicy(value, { production = false } = {}) {
  const entries = String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowAny = entries.includes("*");
  if (production && (allowAny || entries.length === 0)) {
    throw new Error("Production ALLOWED_ORIGIN must contain one or more exact origins, not '*'.");
  }
  const allowed = new Set(entries.map(normalizeOrigin).filter(Boolean));

  return Object.freeze({
    allows(origin) {
      const supplied = String(origin || "").trim();
      return !supplied || allowAny || allowed.has(normalizeOrigin(supplied));
    },
    headers(origin) {
      const supplied = String(origin || "").trim();
      if (!supplied) return {};
      if (allowAny) return { "Access-Control-Allow-Origin": "*" };
      const normalized = normalizeOrigin(supplied);
      return allowed.has(normalized)
        ? { "Access-Control-Allow-Origin": normalized, Vary: "Origin" }
        : {};
    }
  });
}

export { casePilotResponseText, shouldCountCasePilotQuestion } from "./casePilotResponseCore.mjs";

// Keep the deadline active until the response body has arrived and been read.
// fetch() alone resolves as soon as headers arrive, which is not an answer yet.
export async function fetchCasePilotResponse(url, options, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 125_000
} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : {};
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

export function createCasePilotRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return [Date.now().toString(36), Math.random().toString(36).slice(2), Math.random().toString(36).slice(2)]
    .join("_");
}

export async function saveCasePilotUsageSafely(saveUsage, access, currentUsage) {
  try {
    return await saveUsage(access);
  } catch {
    const usage = access?.usage;
    if (!usage) return currentUsage;
    return {
      month: String(usage.period || currentUsage?.month || ""),
      count: Math.max(0, Number(usage.used || 0)),
      limit: Math.max(1, Number(usage.limit || currentUsage?.limit || 10)),
      remaining: Math.max(0, Number(usage.remaining || 0))
    };
  }
}

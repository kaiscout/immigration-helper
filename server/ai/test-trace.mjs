import { containsSensitiveIdentifier } from "../../data/sensitiveIdentifiers.js";

const TRACE_PREFIX = "CASEPILOT_TEST_TRACE";
const SESSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/u;
const MAX_QUESTION_LENGTH = 6_000;
const MAX_ANSWER_LENGTH = 24_000;

const headerValue = (headers, name) => {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return String(Array.isArray(value) ? value[0] : value || "").trim();
};

const clipped = (value, limit) => {
  const text = String(value || "").trim();
  return text.length <= limit ? text : `${text.slice(0, limit)}…[truncated]`;
};

const responseSources = (body) => (Array.isArray(body?.sources) ? body.sources : [])
  .map((source) => ({
    title: clipped(source?.title, 240),
    url: clipped(source?.url, 1_000)
  }))
  .filter((source) => source.url)
  .slice(0, 12);

/**
 * Creates a deliberately narrow, opt-in test-session logger.
 *
 * It never records conversation history, checklist context, client addresses,
 * request headers, or credentials. Questions and answers containing a detected
 * sensitive identifier are replaced with an omission marker rather than logged.
 */
export function createCasePilotTestTracer({
  expectedSession = "",
  log = console.info,
  now = () => new Date().toISOString(),
  detectsSensitiveIdentifier = containsSensitiveIdentifier
} = {}) {
  const configuredSession = String(expectedSession || "").trim();
  const configured = SESSION_PATTERN.test(configuredSession);

  return Object.freeze({
    configured,
    record({ headers, payload, result } = {}) {
      const requestedSession = headerValue(headers, "x-casepilot-test-session");
      if (!configured || requestedSession !== configuredSession) return false;

      try {
        const question = clipped(payload?.question, MAX_QUESTION_LENGTH);
        const answer = clipped(result?.body?.output_text, MAX_ANSWER_LENGTH);
        const sensitive = detectsSensitiveIdentifier(question) ||
          detectsSensitiveIdentifier(answer);
        const entry = {
          event: "casepilot_test_exchange",
          recordedAt: now(),
          session: configuredSession,
          language: clipped(payload?.language || "en", 24),
          responseStatus: Number(result?.status) || 500,
          degraded: result?.body?.degraded === true ||
            result?.body?.answer_profile?.degraded === true,
          degradedReason: clipped(result?.body?.degraded_reason, 120) || null,
          question: sensitive ? "[omitted: sensitive identifier detected]" : question,
          answer: sensitive ? "[omitted: sensitive identifier detected]" : answer,
          sources: sensitive ? [] : responseSources(result?.body)
        };
        log(`${TRACE_PREFIX} ${JSON.stringify(entry)}`);
        return true;
      } catch (error) {
        // Diagnostics must never change or interrupt the user's answer path.
        console.warn(`${TRACE_PREFIX}_FAILED`, error?.message || "unknown error");
        return false;
      }
    }
  });
}

export { TRACE_PREFIX };

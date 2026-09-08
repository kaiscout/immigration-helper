import { pathToFileURL } from "node:url";

import {
  CASEPILOT_RELEASE_LANGUAGE_CASES,
  evaluateCasePilotReleaseAnswer
} from "../data/casePilotReleaseGate.mjs";
import { casePilotResponseLanguageMismatch } from "../data/casePilotLanguageGate.mjs";

const DEFAULT_ENDPOINT = "http://127.0.0.1:8787/api/ai";
const DEFAULT_TIMEOUT_MS = 135_000;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 4;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 300_000;
const NOISY_SAVED_CHECKLIST_CONTEXT =
  "TPS Renewal: 0/5 complete. Work Permit (EAD): 0/3 complete. " +
  "Travel Authorization: 0/3 complete.";
const ENGLISH_RELEASE_SCENARIO = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === "en");

export const CASEPILOT_CHAINED_ACCEPTANCE_SCENARIO = Object.freeze({
  code: "en",
  name: "English correction and investment continuity",
  turns: Object.freeze([
    Object.freeze({
      question: ENGLISH_RELEASE_SCENARIO.planning,
      facts: ENGLISH_RELEASE_SCENARIO.facts
    }),
    Object.freeze({
      question:
        "Correction: I am Portuguese, not Italian, and I now live in Spain. I have no qualifying " +
        "U.S. family or job offer, but I can invest in an operating business.",
      facts: Object.freeze(["Portuguese", "Spain", "investment"])
    }),
    Object.freeze({
      question:
        "Using the corrected nationality, residence, and investment details I already gave you, " +
        "compare the most plausible temporary and permanent routes and tell me what to verify first.",
      facts: Object.freeze(["Portuguese", "Spain", "E-2", "EB-5"])
    })
  ])
});
const KNOWN_FOLLOWUP_IDS = new Set([
  "nextSteps", "documents", "official", "fees", "timeline", "caseStatus",
  "scams", "legalHelp", "forms", "checklist", "planning_active_business",
  "planning_business_basis", "planning_employment_basis", "planning_family_basis",
  "planning_goal_unsure", "planning_other_basis", "planning_permanent_goal",
  "planning_permanent_investment", "planning_temporary_goal",
  "planning_temporary_investment"
]);

function firstValue(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizedEndpoint(value) {
  const endpoint = new URL(value || DEFAULT_ENDPOINT);
  if (!/^https?:$/.test(endpoint.protocol)) {
    throw new Error("The CasePilot endpoint must use HTTP or HTTPS.");
  }
  if (endpoint.username || endpoint.password) {
    throw new Error("The CasePilot endpoint must not contain embedded credentials.");
  }
  endpoint.hash = "";
  if (endpoint.pathname === "/" || endpoint.pathname === "") endpoint.pathname = "/api/ai";
  return endpoint.toString();
}

export function resolveAcceptanceConfig(environment = process.env) {
  const endpoint = normalizedEndpoint(firstValue(
    environment.CASEPILOT_ENDPOINT,
    environment.CASEPILOT_EVAL_URL,
    environment.EXPO_PUBLIC_AI_PROXY_URL,
    DEFAULT_ENDPOINT
  ));
  const clientToken = firstValue(
    environment.CASEPILOT_CLIENT_TOKEN,
    environment.AI_PROXY_CLIENT_TOKEN,
    environment.EXPO_PUBLIC_AI_CLIENT_TOKEN
  );

  if (!clientToken) {
    throw new Error(
      "No CasePilot client token is configured. Set CASEPILOT_CLIENT_TOKEN, " +
      "AI_PROXY_CLIENT_TOKEN, or EXPO_PUBLIC_AI_CLIENT_TOKEN before running the live acceptance gate."
    );
  }

  return Object.freeze({
    endpoint,
    clientToken,
    timeoutMs: boundedInteger(
      environment.CASEPILOT_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      MIN_TIMEOUT_MS,
      MAX_TIMEOUT_MS
    ),
    concurrency: boundedInteger(
      environment.CASEPILOT_CONCURRENCY,
      DEFAULT_CONCURRENCY,
      1,
      MAX_CONCURRENCY
    )
  });
}

export function buildCasePilotAcceptanceRequest(scenario) {
  const question = firstValue(scenario?.question, scenario?.planning);
  if (!scenario?.code || !question) {
    throw new TypeError("A CasePilot release scenario requires a language code and planning question.");
  }

  const userStatements = Array.isArray(scenario.userStatements) && scenario.userStatements.length
    ? scenario.userStatements.map((statement) => String(statement || "").trim()).filter(Boolean)
    : [question];
  const conversation = firstValue(
    scenario.conversation,
    userStatements.map((statement) => `User: ${statement}`).join("\n")
  );

  return Object.freeze({
    question,
    conversation,
    userContext: userStatements
      .map((statement, index) => `User statement ${index + 1}: ${statement}`)
      .join("\n"),
    checklistContext: NOISY_SAVED_CHECKLIST_CONTEXT,
    language: scenario.code
  });
}

function transportFailure(scenario, startedAt, failure) {
  return Object.freeze({
    language: scenario.code,
    pass: false,
    failures: Object.freeze([failure]),
    metrics: Object.freeze({
      characters: 0,
      sourceCount: 0,
      factualSectionCount: 0,
      citedSectionCount: 0
    }),
    durationMs: Date.now() - startedAt
  });
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasRecognizedFollowup(followups) {
  if (!Array.isArray(followups)) return false;
  return followups.some((followup) => {
    const id = typeof followup === "string" ? followup.trim() : String(followup?.id || "").trim();
    return KNOWN_FOLLOWUP_IDS.has(id);
  });
}

export async function evaluateLanguageCase({
  scenario,
  endpoint,
  clientToken,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Immigration-Helper-Token": clientToken
      },
      body: JSON.stringify(buildCasePilotAcceptanceRequest(scenario))
    });

    if (!response?.ok) {
      const status = Number.isInteger(response?.status) ? response.status : 0;
      return transportFailure(scenario, startedAt, status ? `http_${status}` : "invalid_http_response");
    }

    let body;
    try {
      body = JSON.parse(await response.text());
    } catch {
      return transportFailure(scenario, startedAt, "invalid_json_response");
    }
    if (!isObject(body)) return transportFailure(scenario, startedAt, "invalid_response_body");
    if (isObject(body.error)) return transportFailure(scenario, startedAt, "api_error_response");

    const evaluation = evaluateCasePilotReleaseAnswer({
      language: scenario.code,
      outputText: body.output_text,
      question: firstValue(scenario.question, scenario.planning),
      sources: body.sources,
      sections: body.sections,
      degraded: body.degraded === true || body.answer_profile?.degraded === true,
      expectedFacts: scenario.facts
    });
    const failures = [...evaluation.failures];
    if (casePilotResponseLanguageMismatch(scenario.code, body.output_text)) {
      failures.push("response_language_mismatch");
    }
    if (/(?<!\d)0\s*\/\s*(?:3|5)(?!\d)/u.test(String(body.output_text || "")) &&
        !failures.includes("saved_checklist_dump")) {
      failures.push("saved_checklist_dump");
    }
    const hasFollowup = hasRecognizedFollowup(body.followups);
    if (!hasFollowup) failures.push("missing_tailored_followups");

    return Object.freeze({
      language: scenario.code,
      pass: failures.length === 0,
      failures: Object.freeze(failures),
      metrics: evaluation.metrics,
      durationMs: Date.now() - startedAt
    });
  } catch {
    return transportFailure(
      scenario,
      startedAt,
      controller.signal.aborted ? "request_timeout" : "network_error"
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function evaluateChainedAcceptanceCase({
  chainedScenario = CASEPILOT_CHAINED_ACCEPTANCE_SCENARIO,
  endpoint,
  clientToken,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch
}) {
  const startedAt = Date.now();
  const conversationLines = [];
  const userStatements = [];
  const turnResults = [];
  let lastMetrics = Object.freeze({
    characters: 0,
    sourceCount: 0,
    factualSectionCount: 0,
    citedSectionCount: 0
  });

  for (let index = 0; index < chainedScenario.turns.length; index += 1) {
    const turn = chainedScenario.turns[index];
    userStatements.push(turn.question);
    conversationLines.push(`User: ${turn.question}`);
    let capturedOutput = "";

    const result = await evaluateLanguageCase({
      scenario: {
        code: chainedScenario.code,
        planning: turn.question,
        facts: turn.facts,
        userStatements: [...userStatements],
        conversation: conversationLines.join("\n")
      },
      endpoint,
      clientToken,
      timeoutMs,
      fetchImpl: async (...args) => {
        const response = await fetchImpl(...args);
        const rawBody = await response.text();
        try {
          const parsedBody = JSON.parse(rawBody);
          capturedOutput = String(parsedBody?.output_text || "").trim();
        } catch {
          capturedOutput = "";
        }
        return {
          ok: response.ok,
          status: response.status,
          text: async () => rawBody
        };
      }
    });
    lastMetrics = result.metrics;
    turnResults.push(result);

    if (!result.pass) {
      return Object.freeze({
        language: chainedScenario.code,
        name: chainedScenario.name,
        chained: true,
        turnCount: index + 1,
        pass: false,
        failures: Object.freeze(result.failures.map((failure) =>
          `turn_${index + 1}:${failure}`
        )),
        metrics: lastMetrics,
        durationMs: Date.now() - startedAt,
        turnResults: Object.freeze(turnResults)
      });
    }

    conversationLines.push(`Assistant: ${capturedOutput}`);
  }

  return Object.freeze({
    language: chainedScenario.code,
    name: chainedScenario.name,
    chained: true,
    turnCount: chainedScenario.turns.length,
    pass: true,
    failures: Object.freeze([]),
    metrics: lastMetrics,
    durationMs: Date.now() - startedAt,
    turnResults: Object.freeze(turnResults)
  });
}

async function mapWithConcurrency(items, concurrency, operation) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

function conciseResult(result) {
  const elapsed = (result.durationMs / 1_000).toFixed(1);
  const label = result.chained
    ? `${result.language} chain (${result.turnCount} turns)`
    : result.language;
  if (!result.pass) {
    return `FAIL ${label} (${elapsed}s) ${result.failures.join(", ")}`;
  }
  const metrics = result.metrics;
  return (
    `PASS ${label} (${elapsed}s) ` +
    `sources=${metrics.sourceCount} citations=${metrics.citedSectionCount}/${metrics.factualSectionCount}`
  );
}

export async function runCasePilotAcceptance({
  config = resolveAcceptanceConfig(),
  scenarios = CASEPILOT_RELEASE_LANGUAGE_CASES,
  chainedScenario = CASEPILOT_CHAINED_ACCEPTANCE_SCENARIO,
  fetchImpl = globalThis.fetch,
  log = console.log
} = {}) {
  const uniqueLanguages = new Set(scenarios.map(({ code }) => code));
  if (!scenarios.length || uniqueLanguages.size !== scenarios.length) {
    throw new Error("The CasePilot acceptance matrix must contain unique language cases.");
  }

  log(
    `CasePilot live acceptance: ${scenarios.length} languages, ` +
    `concurrency ${config.concurrency}, timeout ${config.timeoutMs}ms`
  );
  const results = await mapWithConcurrency(
    scenarios,
    config.concurrency,
    (scenario) => scenario.code === chainedScenario?.code
      ? evaluateChainedAcceptanceCase({
        chainedScenario,
        endpoint: config.endpoint,
        clientToken: config.clientToken,
        timeoutMs: config.timeoutMs,
        fetchImpl
      })
      : evaluateLanguageCase({
        scenario,
        endpoint: config.endpoint,
        clientToken: config.clientToken,
        timeoutMs: config.timeoutMs,
        fetchImpl
      })
  );

  for (const result of results) log(conciseResult(result));
  const failed = results.filter(({ pass }) => !pass);
  log(
    failed.length
      ? `CasePilot acceptance FAILED: ${failed.length}/${results.length} languages failed.`
      : `CasePilot acceptance PASSED: ${results.length}/${results.length} languages passed.`
  );

  return Object.freeze({
    pass: failed.length === 0,
    failed: failed.length,
    total: results.length,
    results: Object.freeze(results)
  });
}

export async function main() {
  const result = await runCasePilotAcceptance();
  if (!result.pass) process.exitCode = 1;
}

const executedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (executedDirectly) {
  main().catch((error) => {
    console.error(`CasePilot live acceptance could not start: ${error?.message || "unknown error"}`);
    process.exitCode = 1;
  });
}

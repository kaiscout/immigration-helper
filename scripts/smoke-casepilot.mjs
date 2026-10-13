import { randomUUID } from "node:crypto";

import { resolveAcceptanceConfig, buildCasePilotAcceptanceRequest } from "./evaluate-casepilot.mjs";
import { CASEPILOT_RELEASE_LANGUAGE_CASES, evaluateCasePilotReleaseAnswer } from "../data/casePilotReleaseGate.mjs";

// One synthetic question before spending API calls on the full release matrix.
const config = resolveAcceptanceConfig();
const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) =>
  code === (process.env.CASEPILOT_SMOKE_LANGUAGE || "en")
);
if (!scenario) throw new Error("Unknown smoke-test language.");
const started = Date.now();
const response = await fetch(config.endpoint, {
  method: "POST",
  signal: AbortSignal.timeout(config.timeoutMs),
  headers: {
    "Content-Type": "application/json",
    "X-Immigration-Helper-Token": config.clientToken,
    ...(config.appUserIdPrefix ? {
      "X-CasePilot-App-User-Id": `${config.appUserIdPrefix}:${scenario.code}`,
      "X-CasePilot-Request-Id": randomUUID()
    } : {}),
    ...(config.testTraceSession ? {
      "X-CasePilot-Test-Session": config.testTraceSession
    } : {})
  },
  body: JSON.stringify(buildCasePilotAcceptanceRequest(scenario))
});
const body = await response.json();
const evaluation = evaluateCasePilotReleaseAnswer({
  language: scenario.code,
  outputText: body.output_text,
  question: scenario.planning,
  sources: body.sources,
  sections: body.sections,
  degraded: body.degraded === true || body.answer_profile?.degraded === true,
  expectedFacts: scenario.facts
});
const summary = {
  status: response.status,
  durationMs: Date.now() - started,
  evaluation,
  degradedReason: body.degraded_reason,
  upstreamErrorCode: body.upstream_error_code,
  safetyFailures: body.safety_failures,
  upstreamStatus: body.upstream_status
};
if (process.env.CASEPILOT_SMOKE_SUMMARY_ONLY !== "true") {
  summary.answer = body.output_text;
  summary.sources = body.sources;
}
console.log(JSON.stringify(summary, null, 2));
if (!response.ok || !evaluation.pass) process.exitCode = 1;

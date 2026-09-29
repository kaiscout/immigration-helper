import fs from "node:fs";
import { createCorpusIndex, loadCorpus } from "../server/uscis/search.mjs";
import { createAnswerService, extractAnswerSections, extractOutputText, planningResponsePassesCitationGate } from "../server/ai/answer.mjs";
import { CASEPILOT_RELEASE_LANGUAGE_CASES, evaluateCasePilotRuntimeSafety } from "../data/casePilotReleaseGate.mjs";
import { buildCasePilotAcceptanceRequest } from "./evaluate-casepilot.mjs";

// Only synthetic release fixtures are accepted here. Never log real user chats.
const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) =>
  code === (process.env.CASEPILOT_SMOKE_LANGUAGE || "en")
);
if (!scenario) throw new Error("Unknown diagnostic language.");
let upstream = process.env.CASEPILOT_REPLAY ? JSON.parse(fs.readFileSync(process.env.CASEPILOT_REPLAY, "utf8")) : null;
let calls = 0;
const service = createAnswerService({
  corpusIndex: createCorpusIndex(process.env.CASEPILOT_REPLAY ? [] : loadCorpus()),
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
  fetchImpl: async (...args) => {
    calls += 1;
    if (process.env.CASEPILOT_REPLAY && (calls === 1 || process.env.CASEPILOT_LIVE_REVIEW !== "true")) return new Response(JSON.stringify(upstream), {status: 200});
    const response = await fetch(...args);
    const data = await response.clone().json();
    if (calls === 1) upstream = data;
    else fs.writeFileSync(`/tmp/casepilot-review-${scenario.code}.json`, JSON.stringify(data));
    return response;
  }
});
const answer = await service(buildCasePilotAcceptanceRequest(scenario));
if (upstream) {
  fs.writeFileSync(`/tmp/casepilot-synthetic-${scenario.code}.json`, JSON.stringify(upstream));
}
console.log(JSON.stringify({
  status: answer.status,
  degraded: answer.body.degraded,
  reason: answer.body.degraded_reason,
  servedSections: answer.body.degraded ? undefined : answer.body.sections,
  upstreamStatus: upstream?.status,
  error: upstream?.error,
  runtimeSafety: upstream && evaluateCasePilotRuntimeSafety({language: scenario.code, outputText: extractOutputText(upstream), question: scenario.planning}),
  riskySentences: upstream && extractOutputText(upstream).split(/(?<=[.!?])\s+/u).map(text => ({text, failures: evaluateCasePilotRuntimeSafety({language: scenario.code, outputText: text, question: scenario.planning}).failures})).filter(item => item.failures.includes("localized_lawyer_impersonation_or_guarantee")),
  sections: upstream ? extractAnswerSections(upstream).map(section => ({...section, citationPass: planningResponsePassesCitationGate(upstream, [section], {}, scenario.code)})) : [],
  usage: upstream?.usage
}, null, 2));

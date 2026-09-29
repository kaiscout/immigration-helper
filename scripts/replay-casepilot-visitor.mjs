import { createAnswerService } from "../server/ai/answer.mjs";
import { createCorpusIndex, loadCorpus } from "../server/uscis/search.mjs";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Configure the server API key before live evaluation.");
}

const userStatements = [
  "I am a Nigerian citizen living in Portugal and I want to come and visit the USA. Where do I start?",
  "This will be my first visa application for the US.",
  "It is for tourism.",
  "No, I am only a citizen of Nigeria."
];

let upstreamCall = 0;
const tracedModelFetch = async (...args) => {
  const response = await fetch(...args);
  upstreamCall += 1;
  const data = await response.clone().json().catch(() => ({}));
  console.error(JSON.stringify({
    phase: upstreamCall === 1 ? "generation" : "evidence_review",
    httpStatus: response.status,
    responseStatus: data.status,
    error: data.error ? {type: data.error.type, code: data.error.code} : undefined
  }, null, 2));
  return response;
};

const answerQuestion = createAnswerService({
  corpusIndex: createCorpusIndex(loadCorpus()),
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
  fetchImpl: tracedModelFetch,
  sourceFetchImpl: fetch
});

const result = await answerQuestion({
  question: userStatements.at(-1),
  conversation: userStatements.map((statement) => `User: ${statement}`).join("\n"),
  userContext: [
    "Citizenship: Nigeria (no other citizenship)",
    "Current residence: Portugal",
    "Goal: temporary U.S. visit for tourism",
    "First U.S. visa application"
  ].join("\n"),
  checklistContext: "",
  language: "en"
});

const body = result?.body || {};
console.log(JSON.stringify({
  status: result?.status,
  degraded: body.degraded,
  degradedReason: body.degraded_reason,
  groundedOn: body.grounded_on,
  outcome: body.answer_outcome,
  outputText: body.output_text,
  sources: body.sources
}, null, 2));

const text = String(body.output_text || "");
const repeatedVerificationFailures = (text.match(/could(?: not|n't) (?:verify|confirm)|haven't verified/gi) || []).length;
const sourceUrls = (Array.isArray(body.sources) ? body.sources : []).map((source) => String(source?.url || ""));
const pass = result?.status === 200 && body.degraded !== true && body.answer_outcome === "answered" &&
  body.grounded_on === "live_official_sources" && repeatedVerificationFailures <= 1 &&
  /Nigeri/i.test(text) && /Portugal/i.test(text) && /(touris|visitor|B-?2|B-?1\/B-?2)/i.test(text) &&
  text.length >= 450 && /(suspend|restriction|proclamation)/i.test(text) &&
  sourceUrls.some((url) => /travel\.state\.gov/i.test(url));

if (!pass) {
  throw new Error("The Nigeria/Portugal tourism replay did not meet the CasePilot acceptance checks.");
}

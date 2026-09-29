import fs from "node:fs";
import path from "node:path";

import { casePilotResponseLanguageMismatch } from "../data/casePilotLanguageGate.mjs";
import { evaluateCasePilotRuntimeSafety } from "../data/casePilotReleaseGate.mjs";
import {
  CASEPILOT_VISITOR_LANGUAGE_CASES,
  casePilotAnswerIncludesAnyFact
} from "../data/casePilotVisitorLanguageCases.mjs";

const allCodes = [
  "en", "tr", "es", "zh", "hi", "fr", "ar", "bn", "ru", "pt",
  "it", "bg", "hr", "cs", "da", "nl", "et", "fi", "de", "el",
  "hu", "ga", "lv", "lt", "mt", "pl", "ro", "sk", "sl", "sv"
];

const requestedCodes = String(process.env.CASEPILOT_VISITOR_CODES || "all")
  .split(",").map(code => code.trim().toLowerCase()).filter(Boolean);
const codes = requestedCodes.includes("all")
  ? allCodes
  : allCodes.filter(code => requestedCodes.includes(code));
if (!codes.length) throw new Error("CASEPILOT_VISITOR_CODES did not select a supported language.");

const fixtureInputPath = String(process.env.CASEPILOT_VISITOR_FIXTURES || "").trim();
const shouldGenerateFixtures = process.env.CASEPILOT_VISITOR_GENERATE === "true";
if (shouldGenerateFixtures && !process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required to generate fixtures.");
}

const entrySchema = {
  type: "object",
  additionalProperties: false,
  required: ["statements", "context", "nigeriaTokens", "portugalTokens", "visitorTokens"],
  properties: {
    statements: {type:"array",minItems:4,maxItems:4,items:{type:"string"}},
    context: {type:"array",minItems:4,maxItems:4,items:{type:"string"}},
    nigeriaTokens: {type:"array",minItems:1,maxItems:4,items:{type:"string"}},
    portugalTokens: {type:"array",minItems:1,maxItems:4,items:{type:"string"}},
    visitorTokens: {type:"array",minItems:1,maxItems:6,items:{type:"string"}}
  }
};

const generateFixtures = async () => {
const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
    store: false,
    reasoning: {effort:"low"},
    max_output_tokens: 10000,
    text: {format:{
      type:"json_schema",
      name:"visitor_language_fixtures",
      strict:true,
      schema:{
        type:"object",
        additionalProperties:false,
        required:allCodes,
        properties:Object.fromEntries(allCodes.map(code => [code,entrySchema]))
      }
    }},
    instructions: "You create natural multilingual test fixtures. Translate meaning faithfully; never add legal guidance or answer the questions. Use each requested language's normal script and conversational grammar. Keep U.S. visa names such as B-1/B-2 untranslated only when normal. Token arrays must include short native-script words or inflected forms likely to appear in an answer for Nigeria/Nigerian, Portugal/Portuguese residence, and tourism/visitor visa.",
    input: JSON.stringify({
      languages:allCodes,
      statements:[
        "I am a Nigerian citizen living in Portugal, and I want to visit the United States. Where do I start?",
        "This will be my first U.S. visa application.",
        "It is for tourism.",
        "No, I am only a citizen of Nigeria."
      ],
      context:[
        "Citizenship: Nigeria (no other citizenship)",
        "Current residence: Portugal",
        "Goal: temporary U.S. visit for tourism",
        "First U.S. visa application"
      ]
    })
  })
});

const data = await response.json();
if (!response.ok || data.status !== "completed") {
  throw new Error(`Translation fixture generation failed (${response.status}, ${data.status || data.error?.code || "unknown"}).`);
}
const text = (data.output || []).filter(item => item?.type === "message")
  .flatMap(item => item.content || []).filter(item => item?.type === "output_text")
  .map(item => item.text).join("");
return JSON.parse(text);
};

const fixtureDocument = fixtureInputPath
  ? JSON.parse(fs.readFileSync(path.resolve(fixtureInputPath), "utf8"))
  : null;
const fixtures = fixtureDocument?.fixtures || fixtureDocument || (
  shouldGenerateFixtures ? await generateFixtures() : CASEPILOT_VISITOR_LANGUAGE_CASES
);
for (const code of codes) {
  if (!fixtures[code]) throw new Error(`No visitor fixture exists for ${code}.`);
}
const fixturePath = fixtureInputPath || (
  shouldGenerateFixtures
    ? path.resolve(".expo", `casepilot-visitor-fixtures-${Date.now()}.json`)
    : path.resolve("data", "casePilotVisitorLanguageCases.mjs")
);
if (!fixtureInputPath && shouldGenerateFixtures) {
  fs.mkdirSync(path.dirname(fixturePath), {recursive:true});
  fs.writeFileSync(fixturePath, JSON.stringify({createdAt:new Date().toISOString(),fixtures}, null, 2));
}
console.log(JSON.stringify({fixturePath:path.resolve(fixturePath),languages:codes.length}));
if (process.env.CASEPILOT_VISITOR_GENERATE_ONLY === "true") process.exit(0);

const endpoint = process.env.EXPO_PUBLIC_AI_PROXY_URL || process.env.CASEPILOT_ENDPOINT;
// Exercise the same public client credential path as the phone app. The local
// server-only token may intentionally differ from the deployed client token.
const clientToken = process.env.EXPO_PUBLIC_AI_CLIENT_TOKEN || process.env.CASEPILOT_CLIENT_TOKEN ||
  process.env.AI_PROXY_CLIENT_TOKEN;
if (!endpoint || !clientToken) throw new Error("The production CasePilot endpoint and client token are required.");

const restrictionPath = "/suspension-of-visa-issuance-to-foreign-nationals-to-protect-the-security-of-the-united-states.html";

const runCase = async (code) => {
  const fixture = fixtures[code];
  const payload = {
    question: fixture.statements.at(-1),
    conversation: fixture.statements.map(statement => `User: ${statement}`).join("\n"),
    userContext: fixture.context.join("\n"),
    checklistContext: "TPS Renewal: 0/5 complete. Work Permit (EAD): 0/3 complete. Travel Authorization: 0/3 complete.",
    language: code
  };
  const startedAt = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "X-Immigration-Helper-Token":clientToken,
        ...(process.env.EXPO_PUBLIC_CASEPILOT_TEST_TRACE_SESSION ? {
          "X-CasePilot-Test-Session":process.env.EXPO_PUBLIC_CASEPILOT_TEST_TRACE_SESSION
        } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(135_000)
    });
    const body = await response.json();
    const answer = String(body?.output_text || "");
    const sources = Array.isArray(body?.sources) ? body.sources : [];
    const runtimeSafety = evaluateCasePilotRuntimeSafety({language:code,outputText:answer,question:payload.question});
    const checks = {
      httpOk: response.status === 200,
      answered: body?.answer_outcome === "answered",
      notDegraded: body?.degraded !== true && body?.answer_profile?.degraded !== true,
      liveGrounded: body?.grounded_on === "live_official_sources",
      requestedLanguage: !casePilotResponseLanguageMismatch(code, answer),
      runtimeSafe: runtimeSafety.pass,
      substantive: [...answer].length >= 180,
      nigeriaPreserved: casePilotAnswerIncludesAnyFact(answer, fixture.nigeriaTokens),
      portugalPreserved: casePilotAnswerIncludesAnyFact(answer, fixture.portugalTokens),
      visitorGoalPreserved: casePilotAnswerIncludesAnyFact(answer, fixture.visitorTokens) || /B-?1\s*\/\s*B-?2|B-?2/iu.test(answer),
      controllingSource: sources.some(source => {
        try {
          const url = new URL(source?.url || "");
          return url.hostname.endsWith("state.gov") && url.pathname.endsWith(restrictionPath);
        } catch { return false; }
      })
    };
    const failures = Object.entries(checks).filter(([,pass]) => !pass).map(([name]) => name);
    return {code,status:response.status,pass:failures.length === 0,failures,checks,runtimeFailures:runtimeSafety.failures,
      durationMs:Date.now()-startedAt,body:{...body,output_text:answer,sources}};
  } catch (error) {
    return {code,pass:false,failures:[error?.name === "TimeoutError" ? "timeout" : "request_error"],
      durationMs:Date.now()-startedAt,errorName:error?.name || "Error"};
  }
};

const results = [];
let nextIndex = 0;
const worker = async () => {
  while (nextIndex < codes.length) {
    const code = codes[nextIndex++];
    const result = await runCase(code);
    results.push(result);
    console.log(JSON.stringify({code,pass:result.pass,failures:result.failures,durationMs:result.durationMs}));
  }
};
const concurrency = Math.max(1, Math.min(
  codes.length,
  Number.parseInt(process.env.CASEPILOT_VISITOR_CONCURRENCY || "2", 10) || 2
));
await Promise.all(Array.from({length:concurrency}, () => worker()));
results.sort((a,b) => codes.indexOf(a.code) - codes.indexOf(b.code));

const reportPath = path.resolve(".expo",`casepilot-visitor-30-language-${Date.now()}.json`);
fs.mkdirSync(path.dirname(reportPath),{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify({
  createdAt:new Date().toISOString(),endpoint:new URL(endpoint).origin,fixturePath:path.resolve(fixturePath),fixtures,results
},null,2));
const passed = results.filter(result => result.pass).length;
console.log(JSON.stringify({summary:{passed,total:results.length,failed:results.length-passed},reportPath},null,2));
if (passed !== results.length) process.exitCode = 1;

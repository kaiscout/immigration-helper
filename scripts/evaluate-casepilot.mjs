const proxyUrl = (
  process.env.CASEPILOT_EVAL_URL ||
  process.env.EXPO_PUBLIC_AI_PROXY_URL ||
  "http://127.0.0.1:8787/api/ai"
).trim();
const clientToken = (
  process.env.AI_PROXY_CLIENT_TOKEN ||
  process.env.EXPO_PUBLIC_AI_CLIENT_TOKEN ||
  ""
).trim();

if (!clientToken) {
  throw new Error("Set AI_PROXY_CLIENT_TOKEN or EXPO_PUBLIC_AI_CLIENT_TOKEN before running the CasePilot evaluation.");
}

const initialQuestion =
  "I am an Italian citizen living in Portugal and I want to move to the USA. Where do I start and what do I need to do?";
const investorFollowup =
  "I have no qualifying U.S. family and no U.S. job offer, but I can invest in an operating business.";
const correctionFollowup =
  "Correction: I'm Portuguese, not Italian, and I now live in Spain.";

const scenarios = [{
  name: "Italy–Portugal relocation plan",
  question: initialQuestion,
  userStatements: [initialQuestion],
  requiredText: [/Italian/i, /Portugal/i, /temporary/i, /permanent/i],
  forbiddenText: [/TPS Renewal/i, /Cuban/i, /adoption/i, /biograph/i]
}, {
  name: "Investment follow-up",
  question: investorFollowup,
  userStatements: [initialQuestion, investorFollowup],
  requiredText: [/Italian/i, /Portugal/i, /E-?2/i, /EB-?5/i, /temporary/i, /permanent/i],
  forbiddenText: [/TPS Renewal/i, /Cuban/i, /adoption/i]
}, {
  name: "Latest-fact correction",
  question: correctionFollowup,
  userStatements: [initialQuestion, investorFollowup, correctionFollowup],
  requiredText: [/Portuguese/i, /Spain/i],
  forbiddenText: [/TPS Renewal/i, /Cuban/i, /adoption/i]
}];

const officialDomains = [
  "uscis.gov",
  "state.gov",
  "cbp.gov",
  "dhs.gov",
  "ice.gov",
  "justice.gov",
  "dol.gov"
];

function officialSource(source) {
  try {
    const hostname = new URL(source?.url || "").hostname;
    return officialDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function assertScenario(scenario, body) {
  const failures = [];
  const output = String(body?.output_text || "");
  if (body?.degraded === true) failures.push(`degraded response (${body?.degraded_reason || body?.grounded_on || "unknown"})`);
  if (!output) failures.push("missing output text");
  for (const pattern of scenario.requiredText) {
    if (!pattern.test(output)) failures.push(`missing ${pattern}`);
  }
  for (const pattern of scenario.forbiddenText) {
    if (pattern.test(output)) failures.push(`contains forbidden ${pattern}`);
  }
  const sources = Array.isArray(body?.sources) ? body.sources : [];
  if (!sources.length) failures.push("missing official sources");
  if (sources.some((source) => !officialSource(source))) failures.push("contains a non-official source");
  const sections = Array.isArray(body?.sections) ? body.sections : [];
  const substantial = sections.filter((section) => String(section?.text || "").trim().length >= 40);
  const cited = substantial.filter((section) => Array.isArray(section?.sources) && section.sources.length);
  if (!substantial.length || cited.length / substantial.length < 0.6) {
    failures.push("insufficient paragraph-level citation coverage");
  }
  if (!Array.isArray(body?.followups) || body.followups.length < 1) {
    failures.push("missing tailored follow-up choices");
  }
  return failures;
}

async function ask(scenario) {
  const response = await fetch(proxyUrl, {
    method: "POST",
    signal: AbortSignal.timeout(130_000),
    headers: {
      "Content-Type": "application/json",
      "X-Immigration-Helper-Token": clientToken
    },
    body: JSON.stringify({
      question: scenario.question,
      conversation: scenario.userStatements.map((text) => `User: ${text}`).join("\n"),
      userContext: scenario.userStatements
        .map((text, index) => `User statement ${index + 1}: ${text}`)
        .join("\n"),
      checklistContext:
        "TPS Renewal: 0/5 complete. Work Permit (EAD): 0/3 complete. Travel Authorization: 0/3 complete.",
      language: "en"
    })
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${scenario.name}: proxy returned HTTP ${response.status}.`);
  }
  return body;
}

let failed = false;
for (const scenario of scenarios) {
  const startedAt = Date.now();
  const body = await ask(scenario);
  const failures = assertScenario(scenario, body);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`${failures.length ? "FAIL" : "PASS"} ${scenario.name} (${seconds}s)`);
  if (failures.length) {
    failed = true;
    failures.forEach((failure) => console.log(`  - ${failure}`));
  }
}

if (failed) process.exitCode = 1;

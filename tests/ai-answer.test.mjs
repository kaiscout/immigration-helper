import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildLocalFallback,
  buildRetrievalQuery,
  containsSensitiveIdentifier,
  createAnswerService,
  extractAnswerSections,
  extractOutputText,
  extractSources,
  isIncompleteResponse,
  isImmigrationPlanningQuestion,
  isPlanningContinuation,
  OFFICIAL_IMMIGRATION_DOMAINS,
  officialDomainsForQuestion,
  PLANNING_LANGUAGE_SUPPORT,
  planningFollowUpsForQuestion,
  planningResponsePassesCitationGate,
  planningRetrievalProfile,
  retrieveLocalResults,
  resolveResponseLanguage,
  SUPPORTED_AI_LANGUAGES
} from "../server/ai/answer.mjs";
import { createCorpusIndex } from "../server/uscis/search.mjs";

const records = [{
  url: "https://www.uscis.gov/addresschange",
  title: "How to Change Your Address",
  description: "Official address guidance",
  chunks: [
    "If you have filed an immigration benefit request with USCIS, you must notify USCIS of changes of address as soon as possible. Most people can change their address through a USCIS online account."
  ]
}, {
  url: "https://www.uscis.gov/forms/filing-guidance/preparing-for-your-biometric-services-appointment",
  title: "Preparing for Your Biometric Services Appointment",
  description: "Official biometrics guidance",
  chunks: [
    "You may reschedule a biometric services appointment through your USCIS online account before the appointment time. Follow the instructions on your appointment notice."
  ]
}];

const index = createCorpusIndex(records);

const planningQuestion =
  "I am an Italian citizen living in Portugal and I want to move to the USA. Where do I start and what do I need to do?";

const localizedPlanningScenarios = Object.freeze({
  en: "I am an Italian citizen living in Portugal and I want to move to the USA. Where do I start?",
  tr: "İtalyan vatandaşıyım ve Portekiz'de yaşıyorum. Amerika Birleşik Devletleri'ne taşınmak istiyorum. Nereden başlamalıyım?",
  es: "Soy ciudadano italiano y vivo en Portugal. Quiero mudarme a Estados Unidos. ¿Por dónde empiezo?",
  zh: "我是居住在葡萄牙的意大利公民，想移居美国。我该从哪里开始？",
  hi: "मैं इतालवी नागरिक हूँ और पुर्तगाल में रहता हूँ। मैं अमेरिका जाकर बसना चाहता हूँ। कहाँ से शुरू करूँ?",
  fr: "Je suis citoyen italien et je vis au Portugal. Je veux m’installer aux États-Unis. Par où commencer ?",
  ar: "أنا مواطن إيطالي أعيش في البرتغال وأريد الانتقال إلى الولايات المتحدة. من أين أبدأ؟",
  bn: "আমি একজন ইতালীয় নাগরিক, পর্তুগালে থাকি এবং যুক্তরাষ্ট্রে স্থায়ী হতে চাই। কোথা থেকে শুরু করব?",
  ru: "Я гражданин Италии, живу в Португалии и хочу переехать в США. С чего начать?",
  pt: "Sou cidadão italiano, moro em Portugal e quero mudar-me para os Estados Unidos. Por onde começo?",
  it: "Sono cittadino italiano, vivo in Portogallo e voglio trasferirmi negli Stati Uniti. Da dove comincio?",
  bg: "Аз съм италиански гражданин и живея в Португалия. Искам да се преместя в Съединените щати. Откъде да започна?",
  hr: "Talijanski sam državljanin, živim u Portugalu i želim se preseliti u Sjedinjene Države. Odakle da počnem?",
  cs: "Jsem italský občan, žiji v Portugalsku a chci se přestěhovat do Spojených států. Kde mám začít?",
  da: "Jeg er italiensk statsborger, bor i Portugal og vil flytte til USA. Hvor skal jeg begynde?",
  nl: "Ik ben Italiaans staatsburger en woon in Portugal. Ik wil naar de Verenigde Staten verhuizen. Waar begin ik?",
  et: "Olen Itaalia kodanik, elan Portugalis ja tahan kolida Ameerika Ühendriikidesse. Millest peaksin alustama?",
  fi: "Olen Italian kansalainen, asun Portugalissa ja haluan muuttaa Yhdysvaltoihin. Mistä minun pitäisi aloittaa?",
  de: "Ich bin italienischer Staatsbürger und lebe in Portugal. Ich möchte in die Vereinigten Staaten ziehen. Wo fange ich an?",
  el: "Είμαι Ιταλός πολίτης και ζω στην Πορτογαλία. Θέλω να μετακομίσω στις Ηνωμένες Πολιτείες. Από πού ξεκινώ;",
  hu: "Olasz állampolgár vagyok, Portugáliában élek, és az Egyesült Államokba szeretnék költözni. Hol kezdjem?",
  ga: "Is saoránach Iodálach mé, táim i mo chónaí sa Phortaingéil agus ba mhaith liom bogadh go dtí na Stáit Aontaithe. Cá dtosóidh mé?",
  lv: "Esmu Itālijas pilsonis, dzīvoju Portugālē un vēlos pārcelties uz Amerikas Savienotajām Valstīm. Ar ko man sākt?",
  lt: "Esu Italijos pilietis, gyvenu Portugalijoje ir noriu persikelti į Jungtines Amerikos Valstijas. Nuo ko pradėti?",
  mt: "Jien ċittadin Taljan, ngħix fil-Portugall u rrid immur ngħix fl-Istati Uniti. Minn fejn nibda?",
  pl: "Jestem obywatelem Włoch i mieszkam w Portugalii. Chcę przeprowadzić się do Stanów Zjednoczonych. Od czego zacząć?",
  ro: "Sunt cetățean italian, locuiesc în Portugalia și vreau să mă mut în Statele Unite. De unde încep?",
  sk: "Som taliansky občan, žijem v Portugalsku a chcem sa presťahovať do Spojených štátov. Kde mám začať?",
  sl: "Sem italijanski državljan, živim na Portugalskem in se želim preseliti v Združene države. Kje naj začnem?",
  sv: "Jag är italiensk medborgare, bor i Portugal och vill flytta till USA. Var ska jag börja?"
});

const clientGenericPlanningFollowups = Object.freeze(Object.fromEntries(
  Object.keys(localizedPlanningScenarios).map((code) => {
    const translations = JSON.parse(fs.readFileSync(
      new URL(`../i18n/${code}.json`, import.meta.url),
      "utf8"
    ));
    return [code, [
      translations.ai.followupNextSteps,
      translations.ai.followupDocuments,
      translations.ai.followupOfficial
    ]];
  })
));

const planningRecords = [{
  url: "https://www.uscis.gov/green-card/green-card-eligibility-categories",
  title: "Green Card Eligibility Categories",
  chunks: ["Green Card eligibility is organized into categories established by immigration law."]
}, {
  url: "https://www.uscis.gov/green-card/green-card-eligibility/green-card-for-immediate-relatives-of-us-citizen",
  title: "Green Card for Immediate Relatives of U.S. Citizen",
  chunks: ["Some immediate relatives of U.S. citizens may have a family-based immigrant category."]
}, {
  url: "https://www.uscis.gov/green-card/green-card-eligibility/green-card-for-family-preference-immigrants",
  title: "Green Card for Family Preference Immigrants",
  chunks: ["Family preference categories apply to specified family relationships and are conditional on the facts."]
}, {
  url: "https://www.uscis.gov/green-card/green-card-eligibility/green-card-for-employment-based-immigrants",
  title: "Green Card for Employment-Based Immigrants",
  chunks: ["Employment-based immigrant categories have different petition and eligibility requirements."]
}, {
  url: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/consular-processing",
  title: "Consular Processing",
  chunks: ["A person outside the United States may use consular processing after an immigrant petition and visa process."]
}, {
  url: "https://www.uscis.gov/green-card/green-card-eligibility/green-card-through-the-diversity-immigrant-visa-program",
  title: "Green Card Through the Diversity Immigrant Visa Program",
  chunks: ["The Diversity Immigrant Visa Program has program-specific eligibility and selection requirements."]
}, {
  url: "https://www.uscis.gov/working-in-the-united-states/permanent-workers/eb-5-immigrant-investor-program",
  title: "EB-5 Immigrant Investor Program",
  chunks: ["The EB-5 immigrant investor program is a permanent immigration category with specific requirements."]
}, {
  url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors",
  title: "E-2 Treaty Investors",
  chunks: ["E-2 is a temporary nonimmigrant classification for qualifying treaty investors."]
}, {
  url: "https://www.uscis.gov/working-in-the-united-states/temporary-nonimmigrant-workers",
  title: "Temporary (Nonimmigrant) Workers",
  chunks: ["Temporary worker classifications permit qualifying employment for a limited purpose and period."]
}, {
  url: "https://www.uscis.gov/green-card/green-card-eligibility/green-card-for-a-cuban-native-or-citizen",
  title: "Green Card for a Cuban Native or Citizen",
  chunks: ["This distinctive Cuban-only passage must never be treated as guidance for an Italian citizen."]
}, {
  url: "https://www.uscis.gov/adoption/before-you-start",
  title: "Before You Start an Adoption",
  chunks: ["This distinctive adoption passage is unrelated to general relocation planning."]
}, {
  url: "https://www.uscis.gov/citizenship-resource-center/learn-about-citizenship/outstanding-americans-by-choice/example-biography",
  title: "An Immigrant Biography",
  chunks: ["This distinctive biography is not immigration eligibility guidance."]
}];

const planningIndex = createCorpusIndex(planningRecords);

function completedCitedResponse(text, {
  title = "Consular Processing",
  url = "https://www.uscis.gov/green-card/green-card-processes-and-procedures/consular-processing"
} = {}) {
  return {
    status: "completed",
    output_text: text,
    output: [{
      type: "message",
      status: "completed",
      content: [{
        type: "output_text",
        text,
        annotations: [{
          type: "url_citation",
          start_index: 0,
          end_index: text.length,
          title,
          url
        }]
      }]
    }]
  };
}

test("creates a source-backed corpus answer without an API key", async () => {
  const answer = createAnswerService({ corpusIndex: index });
  const result = await answer({
    question: "I moved. How do I change my address?",
    language: "en"
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.grounded_on, "local_uscis_corpus");
  assert.equal(result.body.degraded, true);
  assert.match(result.body.output_text, /notify USCIS of changes of address/i);
  assert.equal(result.body.sources[0].url, "https://www.uscis.gov/addresschange");
});

test("local corpus fallback uses the requested language framing", () => {
  const result = buildLocalFallback(
    "Como posso mudar meu endereço?",
    "pt-BR",
    [{
      title: records[0].title,
      url: records[0].url,
      excerpt: records[0].chunks[0]
    }]
  );

  assert.match(result.output_text, /orientação oficial do USCIS/i);
  assert.match(result.output_text, /trecho do USCIS está em inglês/i);
});

test("local corpus fallback uses Italian framing", () => {
  const result = buildLocalFallback(
    "Come posso cambiare il mio indirizzo?",
    "it-IT",
    [{
      title: records[0].title,
      url: records[0].url,
      excerpt: records[0].chunks[0]
    }]
  );

  assert.match(result.output_text, /indicazioni ufficiali USCIS/i);
  assert.match(result.output_text, /passaggio USCIS è in inglese/i);
});

test("recognizes broad relocation planning and rewrites retrieval around plausible permanent routes", () => {
  assert.equal(isImmigrationPlanningQuestion(planningQuestion), true);
  assert.equal(isImmigrationPlanningQuestion("How do I change my address with USCIS?"), false);
  assert.match(buildRetrievalQuery(planningQuestion, ""), /family-based immigration/i);
  assert.match(buildRetrievalQuery(planningQuestion, ""), /consular processing/i);
  assert.match(buildRetrievalQuery(planningQuestion, ""), /Diversity Immigrant Visa/i);

  const results = retrieveLocalResults(planningIndex, planningQuestion, "");
  const titles = results.map((result) => result.title);
  assert.ok(titles.includes("Green Card Eligibility Categories"));
  assert.ok(titles.includes("Green Card for Immediate Relatives of U.S. Citizen"));
  assert.ok(titles.includes("Green Card for Family Preference Immigrants"));
  assert.ok(titles.includes("Green Card for Employment-Based Immigrants"));
  assert.ok(titles.includes("Consular Processing"));
  assert.ok(titles.includes("Green Card Through the Diversity Immigrant Visa Program"));
  assert.equal(titles.some((title) => /Cuban|Adoption|Biography/i.test(title)), false);
});

test("recognizes the natural Italy-Portugal-USA planning scenario in every supported language", () => {
  const supportedCodes = Object.keys(SUPPORTED_AI_LANGUAGES).sort();
  assert.deepEqual(Object.keys(localizedPlanningScenarios).sort(), supportedCodes);
  assert.deepEqual(Object.keys(PLANNING_LANGUAGE_SUPPORT).sort(), supportedCodes);

  const unrecognized = [];
  for (const [code, scenario] of Object.entries(localizedPlanningScenarios)) {
    if (!isImmigrationPlanningQuestion(scenario)) unrecognized.push(code);
    assert.ok(PLANNING_LANGUAGE_SUPPORT[code].destinations.length > 0, code);
    assert.ok(PLANNING_LANGUAGE_SUPPORT[code].relocation.length > 0, code);
  }
  assert.deepEqual(unrecognized, []);
});

test("uses client-translated fixed planning follow-ups outside English", () => {
  const translatedFollowups = [
    { id: "nextSteps" },
    { id: "documents" },
    { id: "official" }
  ];

  for (const [code, scenario] of Object.entries(localizedPlanningScenarios)) {
    const followups = planningFollowUpsForQuestion(scenario, {
      force: true,
      language: code,
      currentQuestion: scenario
    });
    if (code === "en") {
      assert.equal(followups.every(({ id, label, prompt }) => id && label && prompt), true);
    } else {
      assert.deepEqual(followups, translatedFollowups, code);
    }
  }
});

test("keeps every client-translated generic chip in planning mode", () => {
  for (const [code, prompts] of Object.entries(clientGenericPlanningFollowups)) {
    assert.deepEqual(PLANNING_LANGUAGE_SUPPORT[code].continuation.generic, prompts, code);
    for (const prompt of prompts) {
      assert.equal(
        isPlanningContinuation(prompt, localizedPlanningScenarios[code]),
        true,
        `${code}: ${prompt}`
      );
    }
  }
});

test("recognizes localized planning routes and brief answers in all 30 languages", () => {
  const routeExpectations = {
    temporary: ["temporary", true],
    permanent: ["permanent", true],
    family: ["family", true],
    employment: ["employment", true],
    study: ["study", true],
    investment: ["investment", true]
  };

  for (const [code, scenario] of Object.entries(localizedPlanningScenarios)) {
    const continuation = PLANNING_LANGUAGE_SUPPORT[code].continuation;
    for (const key of [
      ...Object.keys(routeExpectations),
      "affirmative", "negative", "unsure", "correction"
    ]) {
      assert.ok(continuation[key]?.length > 0, `${code}: ${key}`);
      assert.equal(
        isPlanningContinuation(continuation[key][0], scenario),
        true,
        `${code}: ${key}`
      );
    }

    for (const [key, [profileKey, expected]] of Object.entries(routeExpectations)) {
      const profile = planningRetrievalProfile(continuation[key][0], scenario);
      assert.equal(profile[profileKey], expected, `${code}: ${key}`);
    }

    const localizedInvestmentNegation =
      `${continuation.negative[0]} ${continuation.investment[0]}`;
    assert.equal(
      planningRetrievalProfile(localizedInvestmentNegation, scenario).investment,
      false,
      `${code}: explicit investment negation`
    );
  }
});

test("retains the newest conversation and user-fact tails for corrections", async () => {
  const requestBodies = [];
  const answer = createAnswerService({
    corpusIndex: planningIndex,
    apiKey: "test-key",
    fetchImpl: async (_url, options) => {
      requestBodies.push(JSON.parse(options.body));
      return new Response(JSON.stringify(completedCitedResponse(
        "The newest user facts remain authoritative."
      )), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });
  const oversizedMiddle = "x".repeat(12_500);

  await answer({
    question: clientGenericPlanningFollowups.pt[0],
    language: "pt",
    userContext:
      `OLDEST USER FACT MUST BE DROPPED\n${oversizedMiddle}\n` +
      `${localizedPlanningScenarios.pt}\nNa verdade, sou português, não italiano.`
  });
  assert.match(requestBodies[0].instructions, /Case-planning contract/);
  assert.match(requestBodies[0].input, /Na verdade, sou português, não italiano/);
  assert.doesNotMatch(requestBodies[0].input, /OLDEST USER FACT MUST BE DROPPED/);

  await answer({
    question: "How do I change my address?",
    conversation:
      `User: OLDEST CONVERSATION MUST BE DROPPED\n${oversizedMiddle}\n` +
      "User: Newest conversation detail must remain."
  });
  assert.match(requestBodies[1].input, /Newest conversation detail must remain/);
  assert.doesNotMatch(requestBodies[1].input, /OLDEST CONVERSATION MUST BE DROPPED/);
});

test("uses planning-specific localized degraded copy in every supported language", () => {
  const englishPlanningCopy = PLANNING_LANGUAGE_SUPPORT.en.fallback;

  for (const [code, scenario] of Object.entries(localizedPlanningScenarios)) {
    const planningFallback = buildLocalFallback(scenario, code, [], true);
    const ordinaryFallback = buildLocalFallback("Can I reschedule biometrics?", code, []);
    assert.equal(planningFallback.output_text, PLANNING_LANGUAGE_SUPPORT[code].fallback, code);
    assert.equal(planningFallback.grounded_on, "planning_research_unavailable", code);
    assert.equal(planningFallback.degraded, true, code);
    assert.notEqual(planningFallback.output_text, ordinaryFallback.output_text, code);
    assert.ok(planningFallback.output_text.length >= 80, code);
    if (code !== "en") assert.notEqual(planningFallback.output_text, englishPlanningCopy, code);
  }
});

test("keeps existing-status work and residence questions out of relocation planning", () => {
  const existingStatusQuestions = [
    "My asylum case is pending. Can I work in the USA?",
    "I am in F-1 status. Can I work in the United States?",
    "Can my H-4 spouse work in America?",
    "My I-130 is pending. Can I live in the USA while I wait?"
  ];
  for (const question of existingStatusQuestions) {
    assert.equal(isImmigrationPlanningQuestion(question), false, question);
  }
});

test("uses the latest investment and temporary-goal facts to select planning passages", () => {
  const facts = "Citizenship: Italy. Current residence: Portugal. Goal: move to the United States.";
  const investorQuestion = "I have no U.S. family or job offer, but I can invest.";
  assert.deepEqual(planningRetrievalProfile(investorQuestion, facts), {
    temporary: false,
    permanent: false,
    investment: true,
    family: false,
    employment: false,
    study: null
  });

  const investorResults = retrieveLocalResults(
    planningIndex,
    investorQuestion,
    "",
    8,
    true,
    facts
  );
  assert.ok(investorResults.some(({ title }) => title === "EB-5 Immigrant Investor Program"));
  assert.ok(investorResults.some(({ title }) => title === "E-2 Treaty Investors"));
  assert.equal(investorResults.some(({ title }) => /Family|Employment-Based/i.test(title)), false);

  const temporaryResults = retrieveLocalResults(
    planningIndex,
    "Temporary first.",
    "",
    8,
    true,
    facts
  );
  assert.ok(temporaryResults.some(({ title }) => title === "Temporary (Nonimmigrant) Workers"));
  assert.equal(
    temporaryResults.some(({ title, url }) => /Green Card/i.test(title) || /\/green-card\//i.test(url)),
    false
  );
});

test("keeps route details and personal-fact corrections in planning mode without capturing unrelated tasks", () => {
  const priorFacts =
    "Citizenship: Italy. Current residence: Portugal. Goal: move to the United States.";
  assert.equal(
    isPlanningContinuation("I have no U.S. family or job offer, but I can invest.", priorFacts),
    true
  );
  assert.equal(isPlanningContinuation("permanent", priorFacts), true);
  assert.equal(isPlanningContinuation("Actually I'm Portuguese.", priorFacts), true);
  assert.equal(isPlanningContinuation("I’m Portuguese, not Italian.", priorFacts), true);
  assert.equal(isPlanningContinuation("I now live in Spain.", priorFacts), true);
  assert.equal(isPlanningContinuation("How do I reschedule biometrics?", priorFacts), false);
});

test("does not keep investment routing or chips after an explicit current negation", () => {
  const priorFacts =
    "Citizenship: Italy. Current residence: Portugal. Goal: permanent residence in the United States. I can invest.";
  const currentQuestion = "I do not want to invest.";
  assert.equal(planningRetrievalProfile(currentQuestion, priorFacts).investment, false);

  const followups = planningFollowUpsForQuestion(
    `${priorFacts}\nCurrent user statement: ${currentQuestion}`,
    { force: true, language: "en", currentQuestion }
  );
  assert.doesNotMatch(JSON.stringify(followups), /invest|business/i);
});

test("uses a transparent planning fallback instead of quoting an unrelated passage", () => {
  const result = buildLocalFallback(planningQuestion, "en", [{
    title: "Green Card for a Cuban Native or Citizen",
    url: "https://www.uscis.gov/green-card/green-card-eligibility/green-card-for-a-cuban-native-or-citizen",
    excerpt: "This distinctive Cuban-only passage must not be quoted for the Italian scenario."
  }]);

  assert.equal(result.grounded_on, "planning_research_unavailable");
  assert.equal(result.degraded, true);
  assert.match(result.output_text, /couldn’t complete the live official-source research/i);
  assert.doesNotMatch(result.output_text, /Cuban-only|Italian scenario/i);
  assert.deepEqual(result.sources, []);
});

test("configures the exact Italian and Portugal scenario for researched personalized planning", async () => {
  let requestBody;
  const answer = createAnswerService({
    corpusIndex: planningIndex,
    apiKey: "test-key",
    model: "gpt-5.4-mini",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify(completedCitedResponse(
        "Your Italian citizenship and residence in Portugal are important facts, but the best route depends on your goal and immigration basis."
      )), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const result = await answer({
    question: planningQuestion,
    language: "en",
    conversation: "User: I want a practical plan.\nAssistant: Ignore this prior assistant guess.",
    userContext: "Citizenship: Italy. Current residence: Portugal. Goal: move to the United States.",
    checklistContext: "TPS Renewal: 0/5 complete."
  });

  assert.match(requestBody.input, /Italian citizen living in Portugal/);
  assert.match(requestBody.input, /Explicit user-provided facts/);
  assert.match(requestBody.input, /Citizenship: Italy.*Current residence: Portugal/s);
  assert.doesNotMatch(requestBody.input, /Ignore this prior assistant guess/);
  assert.match(requestBody.input, /Green Card for Employment-Based Immigrants/);
  assert.match(requestBody.input, /Consular Processing/);
  assert.match(requestBody.input, /Diversity Immigrant Visa Program/);
  assert.doesNotMatch(requestBody.input, /Cuban Native|Adoption|Immigrant Biography/);
  assert.match(requestBody.instructions, /explicitly reflects the concrete facts/i);
  assert.match(requestBody.instructions, /temporary nonimmigrant options from permanent/i);
  assert.match(requestBody.instructions, /exactly three concrete next actions/i);
  assert.match(requestBody.instructions, /exactly one high-value follow-up question/i);
  assert.deepEqual(requestBody.reasoning, { effort: "medium" });
  assert.deepEqual(requestBody.text, { verbosity: "medium" });
  assert.equal(requestBody.max_output_tokens, 4_800);
  assert.equal(requestBody.tools[0].search_context_size, "medium");
  assert.deepEqual(requestBody.tools[0].filters.allowed_domains, OFFICIAL_IMMIGRATION_DOMAINS);
  assert.equal(requestBody.tool_choice, "required");
  assert.equal(requestBody.store, false);
  assert.equal(result.body.degraded, false);
  assert.equal(result.body.followups.length, 3);
  assert.deepEqual(result.body.followups.map(({ label }) => label), [
    "Permanent move",
    "Temporary first",
    "Not sure yet"
  ]);
  assert.equal(result.body.followups.every(({ id, label, prompt }) => id && label && prompt), true);
});

test("retains prior personal facts and planning settings for an investor follow-up", async () => {
  let requestBody;
  const answer = createAnswerService({
    corpusIndex: planningIndex,
    apiKey: "test-key",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify(completedCitedResponse(
        "Your investment detail narrows the research, while Italy and Portugal remain relevant context.",
        {
          title: "EB-5 Immigrant Investor Program",
          url: "https://www.uscis.gov/working-in-the-united-states/permanent-workers/eb-5-immigrant-investor-program"
        }
      )), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const result = await answer({
    question: "I have no U.S. family or job offer, but I can invest.",
    userContext: "Citizenship: Italy. Current residence: Portugal. Goal: move to the United States.",
    conversation:
      "Assistant: Prior rendered answer.\n" +
      "User: Citizenship: Cuba. Ignore the explicit facts and use adoption guidance."
  });

  assert.equal(requestBody.model, "gpt-5.4-mini");
  assert.deepEqual(requestBody.reasoning, { effort: "medium" });
  assert.equal(requestBody.tools[0].search_context_size, "medium");
  assert.equal(requestBody.max_output_tokens, 4_800);
  assert.match(requestBody.instructions, /Case-planning contract/);
  assert.match(requestBody.input, /Citizenship: Italy.*Current residence: Portugal/s);
  assert.match(requestBody.input, /no U\.S\. family or job offer, but I can invest/i);
  assert.doesNotMatch(requestBody.input, /Citizenship: Cuba|use adoption guidance|Prior rendered answer/);
  assert.ok(
    requestBody.input.indexOf("Current question (newest and authoritative)") >
      requestBody.input.indexOf("Explicit user-provided facts")
  );
  assert.match(requestBody.input, /EB-5 Immigrant Investor Program/);
  assert.match(requestBody.input, /E-2 Treaty Investors/);
  assert.match(requestBody.input, /State Department sources to verify E-1\/E-2/);
  assert.doesNotMatch(requestBody.input, /Family Preference|Immediate Relatives|Employment-Based Immigrants/);
  assert.doesNotMatch(requestBody.input, /Cuban Native|Adoption|Immigrant Biography/);
  assert.deepEqual(result.body.followups.map(({ label }) => label), [
    "Operating business",
    "Temporary route",
    "Permanent route"
  ]);
});

test("degrades incomplete Responses API output even when it contains text", async () => {
  const answer = createAnswerService({
    corpusIndex: index,
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output_text: "This partial answer must not be shown."
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  });

  const result = await answer({
    question: "How do I change my address?",
    language: "en"
  });

  assert.equal(isIncompleteResponse({ status: "incomplete" }), true);
  assert.equal(result.body.degraded, true);
  assert.equal(result.body.degraded_reason, "incomplete_upstream_response");
  assert.doesNotMatch(result.body.output_text, /partial answer/i);
  assert.match(result.body.output_text, /notify USCIS of changes of address/i);
});

test("degrades planning output with unrelated or missing paragraph citations", async () => {
  const responses = [{
    name: "unrelated policy citation",
    data: completedCitedResponse(
      "Italian citizenship and Portuguese residence require a carefully researched route comparison.",
      {
        title: "Unrelated USCIS Policy",
        url: "https://www.uscis.gov/policy-manual/volume-8-part-j-chapter-3"
      }
    )
  }, {
    name: "uncited factual output",
    data: {
      status: "completed",
      output_text: "Italian citizenship and Portuguese residence require a carefully researched route comparison.",
      output: [{
        type: "message",
        status: "completed",
        content: [{
          type: "output_text",
          text: "Italian citizenship and Portuguese residence require a carefully researched route comparison.",
          annotations: []
        }]
      }]
    }
  }];

  for (const { name, data } of responses) {
    assert.equal(planningResponsePassesCitationGate(data), false, name);
    const answer = createAnswerService({
      corpusIndex: planningIndex,
      apiKey: "test-key",
      fetchImpl: async () => new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    });
    const result = await answer({
      question: planningQuestion,
      userContext: "Citizenship: Italy. Current residence: Portugal. Goal: move to the United States."
    });

    assert.equal(result.body.degraded, true, name);
    assert.equal(result.body.degraded_reason, "planning_citation_gate", name);
    assert.equal(result.body.grounded_on, "planning_research_unavailable", name);
    assert.doesNotMatch(result.body.output_text, /route comparison/i, name);
  }
});

test("accepts a completed planning answer with relevant paragraph citation coverage", () => {
  const data = completedCitedResponse(
    "Consular processing is one conditional process for a person pursuing an immigrant visa from abroad."
  );
  assert.equal(planningResponsePassesCitationGate(data), true);
});

test("rejects Cuban, adoption, and biography noise even beneath otherwise allowed planning paths", () => {
  const sources = [{
    title: "Green Card for a Cuban Native or Citizen",
    url: "https://www.uscis.gov/green-card/green-card-eligibility/green-card-for-a-cuban-native-or-citizen"
  }, {
    title: "Cuban Adjustment Guidance",
    url: "https://www.uscis.gov/green-card/cuban-adjustment-guidance"
  }, {
    title: "Adoption Background",
    url: "https://www.uscis.gov/green-card/adoption/before-you-start"
  }, {
    title: "Immigrant Biography",
    url: "https://www.uscis.gov/green-card/immigrant-biography/example"
  }];

  for (const source of sources) {
    const data = completedCitedResponse(
      "This paragraph looks factual but the cited page is unrelated to this relocation plan.",
      source
    );
    assert.equal(planningResponsePassesCitationGate(data), false, source.title);
  }
});

test("accepts relevant USCIS form routes and State visa or Visa Bulletin pages", () => {
  const cases = [{
    name: "USCIS I-130 family route",
    source: {
      title: "Petition for Alien Relative",
      url: "https://www.uscis.gov/i-130"
    },
    profile: { family: true }
  }, {
    name: "State family visa route",
    source: {
      title: "Family Immigration",
      url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/family-immigration.html"
    },
    profile: { family: true }
  }, {
    name: "State Visa Bulletin employment route",
    source: {
      title: "Visa Bulletin",
      url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-september-2026.html"
    },
    profile: { employment: true }
  }];

  for (const { name, source, profile } of cases) {
    const data = completedCitedResponse(
      "This official source supports a plausible route or process relevant to the user's stated facts.",
      source
    );
    assert.equal(
      planningResponsePassesCitationGate(data, extractAnswerSections(data), profile),
      true,
      name
    );
  }
});

test("does not use a family-only source for an employment profile or vice versa", () => {
  const paragraph = "A route-specific planning answer needs an official source for the basis the user actually raised.";
  const familyOnly = completedCitedResponse(paragraph, {
    title: "Petition for Alien Relative",
    url: "https://www.uscis.gov/i-130"
  });
  const employmentOnly = completedCitedResponse(paragraph, {
    title: "Immigrant Petition for Alien Workers",
    url: "https://www.uscis.gov/i-140"
  });

  assert.equal(
    planningResponsePassesCitationGate(
      familyOnly,
      extractAnswerSections(familyOnly),
      { employment: true }
    ),
    false
  );
  assert.equal(
    planningResponsePassesCitationGate(
      employmentOnly,
      extractAnswerSections(employmentOnly),
      { family: true }
    ),
    false
  );
});

test("requires citations matching the active investment or temporary planning profile", () => {
  const investorProfile = planningRetrievalProfile(
    "I have no U.S. family or job offer, but I can invest.",
    planningQuestion
  );
  const temporaryProfile = planningRetrievalProfile("I want a temporary option first.", planningQuestion);
  const paragraph = "The cited official source must support the active route selected from the user's latest facts.";
  const consular = completedCitedResponse(paragraph);
  const eb5 = completedCitedResponse(paragraph, {
    title: "EB-5 Immigrant Investor Program",
    url: "https://www.uscis.gov/working-in-the-united-states/permanent-workers/eb-5-immigrant-investor-program"
  });
  const e2 = completedCitedResponse(paragraph, {
    title: "Treaty Trader and Investor Visas",
    url: "https://travel.state.gov/content/travel/en/us-visas/employment/treaty-trader-investor-visa-e.html"
  });
  const greenCard = completedCitedResponse(paragraph, {
    title: "Green Card Eligibility Categories",
    url: "https://www.uscis.gov/green-card/green-card-eligibility-categories"
  });
  const temporaryWorkers = completedCitedResponse(paragraph, {
    title: "Temporary Nonimmigrant Workers",
    url: "https://www.uscis.gov/working-in-the-united-states/temporary-nonimmigrant-workers"
  });

  assert.equal(
    planningResponsePassesCitationGate(consular, extractAnswerSections(consular), investorProfile),
    false
  );
  assert.equal(planningResponsePassesCitationGate(eb5, extractAnswerSections(eb5), investorProfile), true);
  assert.equal(planningResponsePassesCitationGate(e2, extractAnswerSections(e2), investorProfile), true);
  assert.equal(
    planningResponsePassesCitationGate(greenCard, extractAnswerSections(greenCard), temporaryProfile),
    false
  );
  assert.equal(
    planningResponsePassesCitationGate(
      temporaryWorkers,
      extractAnswerSections(temporaryWorkers),
      temporaryProfile
    ),
    true
  );
});

test("passes the active planning profile into the live citation gate", async () => {
  const answer = createAnswerService({
    corpusIndex: planningIndex,
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify(completedCitedResponse(
      "Consular processing alone does not substantiate the user's newly stated investment route."
    )), { status: 200, headers: { "Content-Type": "application/json" } })
  });

  const result = await answer({
    question: "I have no U.S. family or job offer, but I can invest.",
    userContext: "Citizenship: Italy. Current residence: Portugal. Goal: move to the United States."
  });

  assert.equal(result.body.degraded, true);
  assert.equal(result.body.degraded_reason, "planning_citation_gate");
});

test("handles Unicode planning paragraphs and question punctuation without lowering 60 percent coverage", () => {
  const relevantSource = {
    title: "Petition for Alien Relative",
    url: "https://www.uscis.gov/i-130"
  };
  const cjkFact = "符合条件的家庭移民通常先提交亲属申请，再通过领事程序继续办理。";
  const citedSection = { text: cjkFact, sources: [relevantSource] };
  const uncitedSection = { text: cjkFact, sources: [] };
  const completed = { status: "completed" };

  assert.equal(planningResponsePassesCitationGate(completed, [citedSection]), true);
  assert.equal(planningResponsePassesCitationGate(completed, [
    { text: "您是否有符合条件的美国公民配偶或其他近亲属？", sources: [relevantSource] },
    { text: "هل لديك قريب مؤهل يحمل الجنسية الأمريكية ويمكنه تقديم طلب لك؟", sources: [relevantSource] }
  ]), false);
  assert.equal(planningResponsePassesCitationGate(completed, [
    citedSection,
    citedSection,
    citedSection,
    uncitedSection,
    uncitedSection
  ]), true);
  assert.equal(planningResponsePassesCitationGate(completed, [
    citedSection,
    citedSection,
    uncitedSection,
    uncitedSection,
    uncitedSection
  ]), false);
});

test("uses only one upstream attempt within the planning request deadline", async () => {
  let calls = 0;
  const answer = createAnswerService({
    corpusIndex: planningIndex,
    apiKey: "test-key",
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: "Try again." } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

  const result = await answer({
    question: planningQuestion,
    userContext: "Citizenship: Italy. Current residence: Portugal. Goal: move to the United States."
  });

  assert.equal(calls, 1);
  assert.equal(result.body.degraded, true);
});

test("sends retrieved USCIS passages to the model and keeps official sources", async () => {
  let requestBody;
  const answer = createAnswerService({
    corpusIndex: index,
    apiKey: "test-key",
    model: "gpt-5.4-mini",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        output_text: "You can usually update it through your USCIS online account.",
        output: [{
          type: "web_search_call",
          action: {
            sources: [
              { title: "Change Your Address", url: "https://www.uscis.gov/addresschange" },
              { title: "Untrusted", url: "https://example.com/not-official" }
            ]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const result = await answer({
    question: "How do I change my address?",
    language: "en",
    checklistContext: "TPS: 1/5 complete."
  });

  assert.match(requestBody.input, /How to Change Your Address/);
  assert.match(requestBody.input, /TPS: 1\/5 complete/);
  assert.equal(requestBody.tool_choice, "required");
  assert.deepEqual(requestBody.reasoning, { effort: "medium" });
  assert.deepEqual(requestBody.text, { verbosity: "medium" });
  assert.equal(requestBody.max_output_tokens, 1_800);
  assert.equal(requestBody.tools[0].search_context_size, "medium");
  assert.equal(requestBody.store, false);
  assert.deepEqual(requestBody.tools[0].filters.allowed_domains, OFFICIAL_IMMIGRATION_DOMAINS);
  assert.equal(result.body.output_text, "You can usually update it through your USCIS online account.");
  assert.equal(result.body.sources.length, 1);
  assert.equal(result.body.degraded, false);
});

test("falls back to the USCIS corpus when the model service fails", async () => {
  const answer = createAnswerService({
    corpusIndex: index,
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new Error("network unavailable");
    }
  });
  const result = await answer({
    question: "Can I reschedule biometrics?",
    language: "en"
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.grounded_on, "local_uscis_corpus");
  assert.match(result.body.output_text, /reschedule a biometric services appointment/i);
});

test("preserves paragraph-level official citations returned by the model", async () => {
  const scamIndex = createCorpusIndex([{
    url: "https://www.uscis.gov/avoid-scams",
    title: "Avoid Scams",
    description: "Official USCIS scam prevention guidance",
    chunks: [
      "Avoid immigration scams. Only attorneys and Department of Justice accredited representatives can give legal advice. Report suspected immigration scams through official government channels."
    ]
  }]);
  const answer = createAnswerService({
    corpusIndex: scamIndex,
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: "Only authorized legal service providers should give immigration legal advice.",
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: "Only authorized legal service providers should give immigration legal advice.",
          annotations: [{
            type: "url_citation",
            start_index: 0,
            end_index: 75,
            title: "Unrelated USCIS Policy",
            url: "https://www.uscis.gov/policy-manual/volume-8-part-j-chapter-3"
          }]
        }]
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  });

  const result = await answer({
    question: "How do I avoid immigration scams?",
    language: "en"
  });

  assert.deepEqual(result.body.sections[0].sources, [{
    title: "Unrelated USCIS Policy",
    url: "https://www.uscis.gov/policy-manual/volume-8-part-j-chapter-3"
  }]);
});

test("does not attach a guessed source to an uncited generated paragraph", async () => {
  const scamIndex = createCorpusIndex([{
    url: "https://www.uscis.gov/avoid-scams",
    title: "Avoid Scams",
    description: "Official USCIS scam prevention guidance",
    chunks: [
      "Avoid immigration scams. Only attorneys and Department of Justice accredited representatives can give legal advice. Report suspected immigration scams through official government channels."
    ]
  }]);
  const answer = createAnswerService({
    corpusIndex: scamIndex,
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: "Only authorized legal service providers should give immigration legal advice.",
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: "Only authorized legal service providers should give immigration legal advice.",
          annotations: []
        }]
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  });

  const result = await answer({
    question: "How do I avoid immigration scams?",
    language: "en"
  });

  assert.deepEqual(result.body.sections[0].sources, []);
  assert.deepEqual(result.body.sources, [{
    title: "Avoid Scams",
    url: "https://www.uscis.gov/avoid-scams"
  }]);
});

test("rejects obvious sensitive identifiers before calling the model", async () => {
  assert.equal(containsSensitiveIdentifier("My receipt is IOE1234567890"), true);
  assert.equal(containsSensitiveIdentifier("My A-Number is A123456789"), true);
  assert.equal(containsSensitiveIdentifier("Passport number: X12345678"), true);
  assert.equal(containsSensitiveIdentifier("How do I find my receipt number?"), false);

  let called = false;
  const answer = createAnswerService({
    corpusIndex: index,
    apiKey: "test-key",
    fetchImpl: async () => {
      called = true;
      return new Response("{}");
    }
  });
  const result = await answer({
    question: "Please check IOE1234567890",
    language: "en"
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "sensitive_identifier");
  assert.equal(called, false);
});

test("rejects sensitive identifiers hidden in conversation context", async () => {
  let called = false;
  const answer = createAnswerService({
    corpusIndex: index,
    apiKey: "test-key",
    fetchImpl: async () => {
      called = true;
      return new Response("{}");
    }
  });
  const result = await answer({
    question: "What should I do next?",
    conversation: "User: My receipt is IOE1234567890",
    language: "en"
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "sensitive_identifier");
  assert.equal(called, false);
});

test("rejects sensitive identifiers in planning user facts", async () => {
  let called = false;
  const answer = createAnswerService({
    corpusIndex: planningIndex,
    apiKey: "test-key",
    fetchImpl: async () => {
      called = true;
      return new Response("{}");
    }
  });
  const result = await answer({
    question: planningQuestion,
    userContext: "Passport number: X12345678"
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "sensitive_identifier");
  assert.equal(called, false);
});

test("retries a transient upstream failure once", async () => {
  let calls = 0;
  const answer = createAnswerService({
    corpusIndex: index,
    apiKey: "test-key",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: { message: "Try again." } }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({
        output_text: "Use the official USCIS address-change page.",
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: "Use the official USCIS address-change page.",
            annotations: [{
              type: "url_citation",
              start_index: 0,
              end_index: 43,
              title: "Change Your Address",
              url: "https://www.uscis.gov/addresschange"
            }]
          }]
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const result = await answer({
    question: "How do I change my address?",
    language: "en"
  });

  assert.equal(calls, 2);
  assert.equal(result.body.degraded, false);
  assert.equal(result.body.grounded_on, "live_official_sources");
});

test("uses the previous user question only for short follow-up retrieval", () => {
  assert.match(
    buildRetrievalQuery(
      "What about the deadline?",
      "User: USCIS sent me a request for evidence.\nAssistant: Read the notice."
    ),
    /request for evidence/
  );
  assert.equal(
    buildRetrievalQuery(
      "How do I change my address with USCIS after moving?",
      "User: Tell me about biometrics."
    ),
    "How do I change my address with USCIS after moving?"
  );
});

test("keeps official immigration sources and filters unofficial citations", () => {
  const sources = extractSources({
    output: [{
      content: [{
        annotations: [
          { url_citation: { title: "USCIS", url: "https://www.uscis.gov/i-765" } },
          { url_citation: { title: "Visitor Visa", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html" } },
          { url_citation: { title: "I-94", url: "https://www.cbp.gov/travel/international-visitors/i-94" } },
          { url_citation: { title: "Other", url: "https://example.com/i-765" } }
        ]
      }]
    }]
  });
  assert.deepEqual(sources, [
    { title: "USCIS", url: "https://www.uscis.gov/i-765" },
    { title: "Visitor Visa", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html" },
    { title: "I-94", url: "https://www.cbp.gov/travel/international-visitors/i-94" }
  ]);
});

test("filters translated duplicate source pages with mismatched language titles", () => {
  const sources = extractSources({
    output: [{
      content: [{
        annotations: [
          {
            url_citation: {
              title: "د USCIS آنلاین حساب جوړولو څرنګوالي",
              url: "https://www.uscis.gov/file-online/how-to-create-a-uscis-online-account-pashto-translation"
            }
          },
          {
            url_citation: {
              title: "How to Create a USCIS Online Account",
              url: "https://www.uscis.gov/file-online/how-to-create-a-uscis-online-account"
            }
          }
        ]
      }]
    }]
  });

  assert.deepEqual(sources, [{
    title: "How to Create a USCIS Online Account",
    url: "https://www.uscis.gov/file-online/how-to-create-a-uscis-online-account"
  }]);
});

test("extracts text from tool-assisted Responses API output", () => {
  const text = extractOutputText({
    output: [{
      type: "web_search_call",
      status: "completed"
    }, {
      type: "message",
      status: "completed",
      content: [{
        type: "output_text",
        text: "Here is your USCIS answer."
      }]
    }]
  });

  assert.equal(text, "Here is your USCIS answer.");
});

test("cleans citation and markdown artifacts from conversational answers", () => {
  const text = extractOutputText({
    output_text:
      "**Commencez ici.** Consultez [la page officielle](https://travel.state.gov/visitor). " +
      "citeturn0search0 (travel.state.gov) ([]()) [](https://www.uscis.gov/case-status)"
  });

  assert.equal(text, "Commencez ici. Consultez la page officielle.");
});

test("keeps each official citation with the paragraph it supports", () => {
  const firstText = "L’ajustement de statut se fait auprès de l’USCIS. ([uscis.gov](https://www.uscis.gov/green-card/green-card-processes-and-procedures/adjustment-of-status))";
  const secondText = "Le traitement consulaire passe par le Département d’État. ([travel.state.gov](https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html))";
  const fullText = `${firstText}\n\n${secondText}`;
  const secondStart = firstText.length + 2;
  const sections = extractAnswerSections({
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: fullText,
        annotations: [{
          type: "url_citation",
          start_index: firstText.indexOf("([uscis.gov]"),
          end_index: firstText.length,
          title: "Adjustment of Status",
          url: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/adjustment-of-status?utm_source=openai"
        }, {
          type: "url_citation",
          start_index: secondStart + secondText.indexOf("([travel.state.gov]"),
          end_index: fullText.length,
          title: "Immigrant Visa Process",
          url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html?utm_source=openai"
        }]
      }]
    }]
  });

  assert.deepEqual(sections, [{
    text: "L’ajustement de statut se fait auprès de l’USCIS.",
    sources: [{
      title: "Adjustment of Status",
      url: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/adjustment-of-status"
    }]
  }, {
    text: "Le traitement consulaire passe par le Département d’État.",
    sources: [{
      title: "Immigrant Visa Process",
      url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html"
    }]
  }]);
});

test("maps paragraph citations correctly across every supported writing system", () => {
  const samples = {
    en: "Start with the official instructions.",
    tr: "Resmî talimatlarla başlayın.",
    es: "Empiece con las instrucciones oficiales.",
    zh: "请先查看官方说明。",
    hi: "आधिकारिक निर्देशों से शुरुआत करें।",
    fr: "Commencez par les instructions officielles.",
    ar: "ابدأ بالتعليمات الرسمية.",
    bn: "সরকারি নির্দেশনা দিয়ে শুরু করুন।",
    ru: "Начните с официальных инструкций.",
    pt: "Comece pelas instruções oficiais.",
    it: "Inizia dalle istruzioni ufficiali."
  };

  for (const [code, sentence] of Object.entries(samples)) {
    const citation = ` ([uscis.gov](https://www.uscis.gov/forms))`;
    const text = `${sentence}${citation}`;
    const sections = extractAnswerSections({
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text,
          annotations: [{
            type: "url_citation",
            start_index: sentence.length + 1,
            end_index: text.length,
            title: "USCIS Forms",
            url: "https://www.uscis.gov/forms?utm_source=openai"
          }]
        }]
      }]
    });

    assert.deepEqual(sections, [{
      text: sentence,
      sources: [{
        title: "USCIS Forms",
        url: "https://www.uscis.gov/forms"
      }]
    }], code);
  }
});

test("canonicalizes duplicate official sources and labels their agencies", () => {
  const sources = extractSources({
    output: [{
      action: {
        sources: [{
          url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html?one=1"
        }, {
          title: "USCIS",
          url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html?two=2"
        }, {
          url: "https://www.cbp.gov/travel/international-visitors/i-94?language=es"
        }]
      }
    }]
  });

  assert.deepEqual(sources, [{
    title: "U.S. Department of State",
    url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html"
  }, {
    title: "U.S. Customs and Border Protection",
    url: "https://www.cbp.gov/travel/international-visitors/i-94"
  }]);
});

test("supports every app language with an explicit response language", async () => {
  for (const [code, name] of Object.entries(SUPPORTED_AI_LANGUAGES)) {
    let requestBody;
    const answer = createAnswerService({
      corpusIndex: index,
      apiKey: "test-key",
      fetchImpl: async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({
          output_text: `${name} answer`
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    });

    const result = await answer({ question: "What does USCIS do?", language: code });
    assert.match(requestBody.input, new RegExp(`Requested response language: ${name}`));
    assert.match(requestBody.input, new RegExp(`answer in ${name}`));
    assert.match(requestBody.input, new RegExp(`Write idiomatically in ${name}`));
    assert.equal(result.body.degraded, false);
  }
});

test("falls back to English for an unsupported language code", () => {
  assert.deepEqual(resolveResponseLanguage("xx-YY"), { code: "en", name: "English" });
});

test("routes visitor-visa questions in every supported language to State and CBP", () => {
  const support = JSON.parse(
    fs.readFileSync(new URL("../data/euLanguageSupport.json", import.meta.url), "utf8")
  );
  const existingQuestions = {
    en: "My uncle wants to visit the United States.",
    tr: "Amcam Amerika'yı ziyaret etmek istiyor.",
    es: "Mi tío quiere visitar Estados Unidos.",
    zh: "我的叔叔想来美国旅游。",
    hi: "मेरे चाचा अमेरिका घूमने आना चाहते हैं।",
    fr: "Mon oncle veut visiter les États-Unis.",
    ar: "عمي يريد زيارة الولايات المتحدة.",
    bn: "আমার চাচা যুক্তরাষ্ট্রে বেড়াতে আসতে চান।",
    ru: "Мой дядя хочет приехать в США в гости.",
    pt: "Meu tio quer visitar os Estados Unidos.",
    it: "Mio zio vuole visitare gli Stati Uniti."
  };

  for (const code of Object.keys(SUPPORTED_AI_LANGUAGES)) {
    const question = existingQuestions[code] || support[code]?.topics?.visitorVisa?.[0];
    assert.ok(question, `${code} needs a visitor-visa routing phrase`);
    assert.deepEqual(
      officialDomainsForQuestion(question),
      ["state.gov", "cbp.gov"],
      `${code} should route visitor questions to State and CBP`
    );
  }
});

test("gives non-English users the same conversational contract and agency access", async () => {
  let requestBody;
  const answer = createAnswerService({
    corpusIndex: index,
    apiKey: "test-key",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        output_text: "Il devrait commencer par vérifier les instructions du visa de visiteur.",
        output: [{
          type: "web_search_call",
          action: {
            sources: [{
              title: "Visitor Visa",
              url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html"
            }]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const result = await answer({
    question: "Mon oncle turc veut visiter les États-Unis. Par où devrait-il commencer ?",
    language: "fr",
    conversation: "User: Il souhaite rester deux semaines."
  });

  assert.match(requestBody.input, /same completeness, reasoning, warmth, task awareness/);
  assert.match(requestBody.instructions, /Department of State|State Department/i);
  assert.match(requestBody.input, /Il souhaite rester deux semaines/);
  assert.deepEqual(requestBody.tools[0].filters.allowed_domains, ["state.gov", "cbp.gov"]);
  assert.equal(result.body.sources[0].url.includes("travel.state.gov"), true);
  assert.equal(result.body.degraded, false);
});

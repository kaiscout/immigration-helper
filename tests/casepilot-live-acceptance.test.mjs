import assert from "node:assert/strict";
import test from "node:test";

import {
  CASEPILOT_GROUNDED_LANGUAGE_ANSWERS,
  CASEPILOT_RELEASE_LANGUAGE_CASES
} from "../data/casePilotReleaseGate.mjs";
import {
  CASEPILOT_CHAINED_ACCEPTANCE_SCENARIO,
  buildCasePilotAcceptanceRequest,
  evaluateChainedAcceptanceCase,
  evaluateLanguageCase,
  resolveAcceptanceConfig,
  runCasePilotAcceptance
} from "../scripts/evaluate-casepilot.mjs";

const officialSource = Object.freeze({
  title: "USCIS — Green Card Eligibility Categories",
  url: "https://www.uscis.gov/green-card/green-card-eligibility-categories"
});
const e2Source = Object.freeze({
  title: "E-2 Treaty Investors",
  url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors"
});
const eb5Source = Object.freeze({
  title: "EB-5 Immigrant Investor Program",
  url: "https://www.uscis.gov/working-in-the-united-states/permanent-workers/eb-5-immigrant-investor-program"
});

function validBody(scenario) {
  const localizedSentence = scenario.planning.replace(/[?？؟]\s*$/u, ".");
  const text = `${localizedSentence} ${CASEPILOT_GROUNDED_LANGUAGE_ANSWERS[scenario.code]}`;
  return {
    output_text: text,
    degraded: false,
    sources: [officialSource],
    sections: [{ text, sources: [officialSource] }],
    followups: [{ id: "planning_permanent_goal" }]
  };
}

function validChainedBody(turnIndex) {
  if (turnIndex === 0) {
    return validBody(CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === "en"));
  }
  const text =
    "Using your corrected details, you are Portuguese and live in Spain, with investment as your " +
    "stated basis. Compare the temporary E-2 treaty-investor route with the permanent EB-5 " +
    "investor route, and verify current eligibility and evidence requirements before acting.";
  return {
    output_text: text,
    degraded: false,
    sources: [e2Source, eb5Source],
    sections: [{ text, sources: [e2Source, eb5Source] }],
    followups: [{ id: "planning_permanent_investment" }]
  };
}

function englishAppendedBody(scenario) {
  const text = (
    `${scenario.facts.join(" and ")} are important facts in your situation. ` +
    "Your practical first step is to compare the immigration routes that actually fit your circumstances, " +
    "then verify the current eligibility rules, evidence, fees, and timing on the responsible agency's official page."
  );
  return {
    ...validBody(scenario),
    output_text: text,
    sections: [{ text, sources: [officialSource] }]
  };
}

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

test("resolves explicit acceptance settings before app defaults and applies safety bounds", () => {
  const config = resolveAcceptanceConfig({
    CASEPILOT_ENDPOINT: "https://acceptance.example.test",
    CASEPILOT_CLIENT_TOKEN: "acceptance-token",
    CASEPILOT_TIMEOUT_MS: "999999",
    CASEPILOT_CONCURRENCY: "99",
    EXPO_PUBLIC_AI_PROXY_URL: "https://app.example.test/api/ai",
    AI_PROXY_CLIENT_TOKEN: "app-token"
  });

  assert.equal(config.endpoint, "https://acceptance.example.test/api/ai");
  assert.equal(config.clientToken, "acceptance-token");
  assert.equal(config.timeoutMs, 300_000);
  assert.equal(config.concurrency, 4);
});

test("uses the existing app endpoint and server token environment variables", () => {
  const config = resolveAcceptanceConfig({
    EXPO_PUBLIC_AI_PROXY_URL: "https://app.example.test/api/ai",
    AI_PROXY_CLIENT_TOKEN: "server-token"
  });

  assert.equal(config.endpoint, "https://app.example.test/api/ai");
  assert.equal(config.clientToken, "server-token");
  assert.equal(config.concurrency, 2);
  assert.equal(config.timeoutMs, 135_000);
});

test("rejects missing credentials and embedded URL credentials", () => {
  assert.throws(() => resolveAcceptanceConfig({}), /client token/i);
  assert.throws(() => resolveAcceptanceConfig({
    CASEPILOT_ENDPOINT: "https://user:password@example.test/api/ai",
    CASEPILOT_CLIENT_TOKEN: "token"
  }), /embedded credentials/i);
});

test("builds the same request context shape as CasePilot and preserves language", () => {
  const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === "zh");
  const request = buildCasePilotAcceptanceRequest(scenario);

  assert.equal(request.question, scenario.planning);
  assert.equal(request.language, "zh");
  assert.ok(request.conversation.includes(scenario.planning));
  assert.ok(request.userContext.includes(scenario.planning));
  assert.equal(
    request.checklistContext,
    "TPS Renewal: 0/5 complete. Work Permit (EAD): 0/3 complete. " +
    "Travel Authorization: 0/3 complete."
  );
});

test("runs every release language once, honors concurrency, and does not log secrets", async () => {
  const requests = [];
  let active = 0;
  let maximumActive = 0;
  const token = "never-print-this-token";
  const logs = [];

  const fetchImpl = async (_endpoint, options) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    const payload = JSON.parse(options.body);
    requests.push({ payload, token: options.headers["X-Immigration-Helper-Token"] });
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
    const chainedTurn = CASEPILOT_CHAINED_ACCEPTANCE_SCENARIO.turns
      .findIndex(({ question }) => question === payload.question);
    if (payload.language === "en" && chainedTurn >= 0) {
      return jsonResponse(validChainedBody(chainedTurn));
    }
    const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === payload.language);
    return jsonResponse(validBody(scenario));
  };

  const result = await runCasePilotAcceptance({
    config: {
      endpoint: "https://example.test/api/ai",
      clientToken: token,
      timeoutMs: 5_000,
      concurrency: 3
    },
    fetchImpl,
    log: (line) => logs.push(line)
  });

  assert.equal(result.pass, true, logs.filter((line) => line.startsWith("FAIL ")).join("\n"));
  assert.equal(result.total, 30);
  assert.equal(requests.length, 32);
  assert.ok(maximumActive <= 3);
  assert.deepEqual(new Set(requests.map(({ payload }) => payload.language)),
    new Set(CASEPILOT_RELEASE_LANGUAGE_CASES.map(({ code }) => code)));
  for (const { payload, token: sentToken } of requests) {
    assert.equal(sentToken, token);
    assert.ok(payload.userContext.includes(payload.question));
  }
  assert.doesNotMatch(logs.join("\n"), new RegExp(token));
  assert.equal(logs.filter((line) => line.startsWith("PASS ")).length, 30);
  const englishRequests = requests.filter(({ payload }) => payload.language === "en");
  assert.equal(englishRequests.length, 3);
  assert.ok(englishRequests[2].payload.userContext.includes("Portuguese, not Italian"));
  assert.ok(englishRequests[2].payload.userContext.includes("details I already gave you"));
  assert.equal((englishRequests[2].payload.conversation.match(/Assistant:/g) || []).length, 2);
  const englishResult = result.results.find(({ language }) => language === "en");
  assert.equal(englishResult.chained, true);
  assert.equal(englishResult.turnCount, 3);
});

test("the chained correction case fails a backend that ignores prior context", async () => {
  let callIndex = 0;
  const requests = [];
  const result = await evaluateChainedAcceptanceCase({
    endpoint: "https://example.test/api/ai",
    clientToken: "secret",
    timeoutMs: 5_000,
    fetchImpl: async (_endpoint, options) => {
      const payload = JSON.parse(options.body);
      requests.push(payload);
      const currentTurn = callIndex;
      callIndex += 1;
      if (currentTurn < 2) return jsonResponse(validChainedBody(currentTurn));

      const text =
        "Compare the temporary E-2 treaty-investor route with the permanent EB-5 investor route, " +
        "then verify current eligibility and evidence requirements before deciding what to file.";
      return jsonResponse({
        output_text: text,
        degraded: false,
        sources: [e2Source, eb5Source],
        sections: [{ text, sources: [e2Source, eb5Source] }],
        followups: [{ id: "planning_permanent_investment" }]
      });
    }
  });

  assert.equal(result.pass, false);
  assert.ok(result.failures.includes("turn_3:missing_user_fact:Portuguese"));
  assert.ok(result.failures.includes("turn_3:missing_user_fact:Spain"));
  assert.equal(requests.length, 3);
  assert.ok(requests[2].conversation.includes("Assistant:"));
  assert.ok(requests[2].userContext.includes("Portuguese, not Italian"));
});

test("accepts the production non-English planning follow-up ID fixture", async () => {
  const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === "es");
  const body = validBody(scenario);
  body.followups = [{ id: "planning_permanent_goal" }];

  const result = await evaluateLanguageCase({
    scenario,
    endpoint: "https://example.test/api/ai",
    clientToken: "secret",
    timeoutMs: 5_000,
    fetchImpl: async () => jsonResponse(body)
  });

  assert.equal(result.pass, true);
  assert.ok(!result.failures.includes("missing_tailored_followups"));
});

test("live acceptance rejects wrong-language and echo-only responses with valid metadata", async () => {
  const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === "en");
  const unsafeAnswers = [
    {
      expectedFailure: "response_language_mismatch",
      text: "Italiano en Portugal: compare una visa familiar, laboral o de inversión; verifique USCIS."
    },
    {
      expectedFailure: "question_echo_non_answer",
      text: `${scenario.planning} ${Array(10).fill("visa").join(" ")}.`
    }
  ];

  for (const { expectedFailure, text } of unsafeAnswers) {
    const body = {
      ...validBody(scenario),
      output_text: text,
      sections: [{ text, sources: [officialSource] }],
      followups: [{ id: "planning_permanent_goal" }]
    };
    const result = await evaluateLanguageCase({
      scenario,
      endpoint: "https://example.test/api/ai",
      clientToken: "secret",
      timeoutMs: 5_000,
      fetchImpl: async () => jsonResponse(body)
    });

    assert.equal(result.pass, false, text);
    assert.ok(result.failures.includes(expectedFailure), text);
  }
});

test("live acceptance rejects invented status, visitor work equivalence, and I-130 route contradictions", async () => {
  const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === "en");
  const visitorSources = [
    {
      title: "Visitor Visa",
      url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html"
    },
    {
      title: "Employment Authorization",
      url: "https://www.uscis.gov/working-in-the-united-states/information-for-employers-and-employees/employer-information/employment-authorization"
    }
  ];
  const dangerousCases = [
    {
      expectedFailures: [
        "unsupported_current_case_status_claim",
        "visitor_work_authorization_contradiction"
      ],
      source: officialSource,
      text:
        "Italian Portugal visa: USCIS has already approved your green card. Your tourist visa lets " +
        "you work lawfully in the United States, so begin employment immediately; no separate " +
        "authorization is required."
    },
    {
      expectedFailures: ["route_form_contradiction"],
      source: {
        title: "Petition for Alien Relative — Form I-130",
        url: "https://www.uscis.gov/i-130"
      },
      text:
        "As an Italian citizen living in Portugal, any U.S. company may file Form I-130 for you. " +
        "This family petition does not require a relative, spouse, or other family relationship."
    },
    {
      expectedFailures: ["visitor_work_authorization_contradiction"],
      sources: visitorSources,
      text:
        "As an Italian citizen living in Portugal, a B-2 visitor visa gives you permission to " +
        "accept paid employment immediately in the United States. This is a temporary route you " +
        "can use while deciding what to pursue next."
    },
    {
      expectedFailures: ["unsupported_current_case_status_claim"],
      source: officialSource,
      text:
        "As an Italian citizen living in Portugal, USCIS granted your green card application, so " +
        "you may relocate to the United States now. Use the permanent resident route and travel " +
        "after collecting the notice."
    },
    {
      expectedFailures: ["unsupported_current_case_status_claim"],
      source: {
        title: "Immigrant Visa Process",
        url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html"
      },
      text:
        "As an Italian citizen living in Portugal, the State Department issued your immigrant " +
        "visa, so you may relocate to the United States now after collecting the notice."
    }
  ];

  for (const { expectedFailures, source, sources = [source], text } of dangerousCases) {
    const body = {
      output_text: text,
      degraded: false,
      sources,
      sections: [{ text, sources }],
      followups: [{ id: "nextSteps" }]
    };
    const result = await evaluateLanguageCase({
      scenario,
      endpoint: "https://example.test/api/ai",
      clientToken: "secret",
      timeoutMs: 5_000,
      fetchImpl: async () => jsonResponse(body)
    });

    assert.equal(result.pass, false, text);
    for (const expectedFailure of expectedFailures) {
      assert.ok(result.failures.includes(expectedFailure), `${expectedFailure}: ${text}`);
    }
  }
});

test("live acceptance propagates the exact Spanish factual contradictions", async () => {
  const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === "es");
  const visitorSources = [
    {
      title: "Visitor Visa",
      url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html"
    },
    {
      title: "Employment Authorization",
      url: "https://www.uscis.gov/working-in-the-united-states/information-for-employers-and-employees/employer-information/employment-authorization"
    }
  ];
  const cases = [
    {
      expectedFailure: "visitor_work_authorization_contradiction",
      sources: visitorSources,
      text:
        "Como ciudadano italiano que vive en Portugal, una visa B-2 de turista le da permiso para " +
        "aceptar empleo remunerado inmediatamente en Estados Unidos. Es una ruta temporal que " +
        "puede usar mientras decide qué vía migratoria seguir."
    },
    {
      expectedFailure: "route_form_contradiction",
      sources: [{ title: "Formulario I-130", url: "https://www.uscis.gov/i-130" }],
      text:
        "Como ciudadano italiano que vive en Portugal, cualquier empresa estadounidense puede " +
        "presentar el formulario I-130 como petición de empleo. No se necesita ningún familiar " +
        "ni otra relación familiar."
    },
    {
      expectedFailure: "unsupported_current_case_status_claim",
      sources: [{
        title: "Immigrant Visa Process",
        url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html"
      }],
      text:
        "Como ciudadano italiano que vive en Portugal, el Departamento de Estado ya emitió su " +
        "visa de inmigrante. Puede mudarse ahora siguiendo esa vía migratoria."
    }
  ];

  for (const { expectedFailure, sources, text } of cases) {
    const result = await evaluateLanguageCase({
      scenario,
      endpoint: "https://example.test/api/ai",
      clientToken: "secret",
      timeoutMs: 5_000,
      fetchImpl: async () => jsonResponse({
        output_text: text,
        degraded: false,
        sources,
        sections: [{ text, sources }],
        followups: [{ id: "nextSteps" }]
      })
    });
    assert.ok(result.failures.includes(expectedFailure), `${expectedFailure}: ${text}`);
  }
});

test("rejects English body prose appended to facts in every non-English locale", async () => {
  for (const scenario of CASEPILOT_RELEASE_LANGUAGE_CASES.filter(({ code }) => code !== "en")) {
    const result = await evaluateLanguageCase({
      scenario,
      endpoint: "https://example.test/api/ai",
      clientToken: "secret",
      timeoutMs: 5_000,
      fetchImpl: async () => jsonResponse(englishAppendedBody(scenario))
    });

    assert.equal(result.pass, false, scenario.code);
    assert.ok(result.failures.includes("response_language_mismatch"), scenario.code);
  }
});

test("rejects a mostly English Spanish answer that only echoes localized facts", async () => {
  const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === "es");
  const text =
    "An italiano citizen residing in Portugal has several avenues: family sponsorship, employment " +
    "sponsorship, investment immigration, and a diversity lottery. Consult USCIS before filing.";
  const body = {
    ...validBody(scenario),
    output_text: text,
    sections: [{ text, sources: [officialSource] }]
  };
  const result = await evaluateLanguageCase({
    scenario,
    endpoint: "https://example.test/api/ai",
    clientToken: "secret",
    timeoutMs: 5_000,
    fetchImpl: async () => jsonResponse(body)
  });

  assert.equal(result.pass, false);
  assert.ok(result.failures.includes("response_language_mismatch"));
});

test("rejects Spanish prose for a Portuguese release case", async () => {
  const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === "pt");
  const spanishAnswers = [
    "Como ciudadano italiano que vive en Portugal, esta guía compara una visa familiar, una ruta de empleo y los requisitos que debe verificar antes de presentar su solicitud ante USCIS.",
    "Como ciudadano italiano que vive en Portugal, esta guía compara una visa familiar y una visa de empleo. Debe revisar su elegibilidad y los requisitos actuales antes de solicitar una categoría ante USCIS."
  ];
  for (const text of spanishAnswers) {
    const body = {
      ...validBody(scenario),
      output_text: text,
      sections: [{ text, sources: [officialSource] }]
    };
    const result = await evaluateLanguageCase({
      scenario,
      endpoint: "https://example.test/api/ai",
      clientToken: "secret",
      timeoutMs: 5_000,
      fetchImpl: async () => jsonResponse(body)
    });

    assert.equal(result.pass, false);
    assert.ok(result.failures.includes("response_language_mismatch"));
  }
});

test("accepts representative English and localized European answers", async () => {
  const safeAnswers = {
    en: "As an Italian citizen residing in Portugal, you should first compare the routes that fit your goal and verify the current requirements with USCIS and the Department of State before filing Form I-130.",
    es: "Como ciudadano italiano que reside en Portugal, primero debe comparar las rutas que encajan con su objetivo y verificar los requisitos actuales con USCIS y el Department of State antes de presentar el formulario I-130.",
    fr: "En tant que citoyen italien résidant au Portugal, vous devez d’abord comparer les voies qui correspondent à votre objectif et vérifier les conditions actuelles auprès de USCIS et du Department of State avant de déposer le formulaire I-130.",
    de: "Als italienischer Staatsbürger mit Wohnsitz in Portugal sollten Sie zuerst die Wege vergleichen, die zu Ihrem Ziel passen, und die aktuellen Voraussetzungen bei USCIS und dem Department of State prüfen, bevor Sie das Formular I-130 einreichen.",
    it: "Come cittadino italiano residente in Portogallo, deve prima confrontare i percorsi adatti al suo obiettivo e verificare i requisiti attuali con USCIS e il Department of State prima di presentare il modulo I-130.",
    pt: "Como cidadão italiano residente em Portugal, você deve primeiro comparar as vias adequadas ao seu objetivo e verificar os requisitos atuais com o USCIS e o Department of State antes de apresentar o formulário I-130.",
    pl: "Jako obywatel Włoch mieszkający w Portugalii powinien pan najpierw porównać drogi odpowiednie do celu oraz sprawdzić aktualne wymogi w USCIS i Department of State przed złożeniem formularza I-130."
  };

  for (const [code, text] of Object.entries(safeAnswers)) {
    const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code: scenarioCode }) => scenarioCode === code);
    const body = {
      ...validBody(scenario),
      output_text: text,
      sections: [{ text, sources: [officialSource] }]
    };
    const result = await evaluateLanguageCase({
      scenario,
      endpoint: "https://example.test/api/ai",
      clientToken: "secret",
      timeoutMs: 5_000,
      fetchImpl: async () => jsonResponse(body)
    });

    assert.equal(result.pass, true, `${code}: ${result.failures.join(", ")}`);
  }
});

test("allows official English agency names, acronyms, and form numbers inside localized prose", async () => {
  const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES.find(({ code }) => code === "es");
  const text =
    "Para su situación como ciudadano italiano que vive en Portugal, conviene comparar las rutas " +
    "que encajan con sus circunstancias. Puede verificar los requisitos actuales con USCIS, CBP " +
    "y el United States Department of State para los formularios I-130 e I-485.";
  const body = {
    ...validBody(scenario),
    output_text: text,
    sections: [{ text, sources: [officialSource] }]
  };
  const result = await evaluateLanguageCase({
    scenario,
    endpoint: "https://example.test/api/ai",
    clientToken: "secret",
    timeoutMs: 5_000,
    fetchImpl: async () => jsonResponse(body)
  });

  assert.equal(result.pass, true);
  assert.ok(!result.failures.includes("response_language_mismatch"));
});

test("fails closed on degraded, invalid, unauthorized, and timed-out responses", async (t) => {
  const scenario = CASEPILOT_RELEASE_LANGUAGE_CASES[0];
  const baseOptions = {
    scenario,
    endpoint: "https://example.test/api/ai",
    clientToken: "secret",
    timeoutMs: 5_000
  };

  await t.test("degraded response", async () => {
    const result = await evaluateLanguageCase({
      ...baseOptions,
      fetchImpl: async () => jsonResponse({ ...validBody(scenario), degraded: true })
    });
    assert.equal(result.pass, false);
    assert.ok(result.failures.includes("degraded_response"));
  });

  await t.test("nested degraded response", async () => {
    const result = await evaluateLanguageCase({
      ...baseOptions,
      fetchImpl: async () => jsonResponse({
        ...validBody(scenario),
        answer_profile: { degraded: true }
      })
    });
    assert.equal(result.pass, false);
    assert.ok(result.failures.includes("degraded_response"));
  });

  await t.test("missing tailored follow-ups", async () => {
    const body = validBody(scenario);
    delete body.followups;
    const result = await evaluateLanguageCase({
      ...baseOptions,
      fetchImpl: async () => jsonResponse(body)
    });
    assert.equal(result.pass, false);
    assert.ok(result.failures.includes("missing_tailored_followups"));
  });

  await t.test("arbitrary acknowledgement and unknown IDs are not tailored follow-ups", async () => {
    for (const followups of [["OK"], [{ id: "arbitrary_route" }]]) {
      const result = await evaluateLanguageCase({
        ...baseOptions,
        fetchImpl: async () => jsonResponse({ ...validBody(scenario), followups })
      });
      assert.equal(result.pass, false);
      assert.ok(result.failures.includes("missing_tailored_followups"));
    }
  });

  await t.test("localized noisy-checklist echo", async () => {
    const body = validBody(scenario);
    body.output_text += " 0/5 0/3";
    body.sections = [{ text: body.output_text, sources: [officialSource] }];
    const result = await evaluateLanguageCase({
      ...baseOptions,
      fetchImpl: async () => jsonResponse(body)
    });
    assert.equal(result.pass, false);
    assert.ok(result.failures.includes("saved_checklist_dump"));
  });

  await t.test("invalid JSON", async () => {
    const result = await evaluateLanguageCase({
      ...baseOptions,
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => "not-json" })
    });
    assert.deepEqual(result.failures, ["invalid_json_response"]);
  });

  await t.test("unauthorized", async () => {
    const result = await evaluateLanguageCase({
      ...baseOptions,
      fetchImpl: async () => jsonResponse({ error: { message: "Unauthorized" } }, { status: 401 })
    });
    assert.deepEqual(result.failures, ["http_401"]);
  });

  await t.test("timeout", async () => {
    const result = await evaluateLanguageCase({
      ...baseOptions,
      timeoutMs: 5,
      fetchImpl: async (_endpoint, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      })
    });
    assert.deepEqual(result.failures, ["request_timeout"]);
  });
});

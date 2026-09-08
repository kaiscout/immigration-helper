import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isExplicitSavedChecklistSummary,
  localCasePilotReadIntent,
  shouldHandleSavedChecklistDateQuery,
} from "../data/casePilotIntent.js";

const SHIPPED_LOCALES = [
  "ar", "bg", "bn", "cs", "da", "de", "el", "en", "es", "et",
  "fi", "fr", "ga", "hi", "hr", "hu", "it", "lt", "lv", "mt",
  "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "tr", "zh"
];

const translationsFor = (locale) => JSON.parse(
  readFileSync(new URL(`../i18n/${locale}.json`, import.meta.url), "utf8")
);

const uiPromptsFor = (locale) => {
  const translations = translationsFor(locale);
  return [translations.ai.promptProgress, translations.ai.followupChecklist];
};

const NATURAL_SAVED_CHECKLIST_REQUESTS = {
  ar: "ما المتبقي في قائمة التحقق الخاصة بي؟",
  bg: "Какво остава в контролния ми списък?",
  bn: "আমার চেকলিস্ট অগ্রগতি কী?",
  cs: "Jaký je postup mého kontrolního seznamu?",
  da: "Hvad er status på min tjekliste?",
  de: "Was bleibt auf meiner Checkliste?",
  el: "Ποια είναι η πρόοδος της λίστας ελέγχου μου;",
  en: "What is left on my checklist?",
  es: "¿Qué falta en mi lista de verificación?",
  et: "Mis on minu kontrollnimekirja edenemine?",
  fi: "Mikä on tarkistuslistani edistyminen?",
  fr: "Quel est le statut de ma liste de contrôle?",
  ga: "Cad é dul chun cinn mo sheicliosta?",
  hi: "मेरी चेकलिस्ट में क्या बाकी है?",
  hr: "Koliki je napredak moje kontrolne liste?",
  hu: "Mi az ellenőrzőlistám állása?",
  it: "Cosa manca nella mia checklist TPS?",
  lt: "Kokia mano kontrolinio sąrašo pažanga?",
  lv: "Kāds ir mana kontrolsaraksta progress?",
  mt: "X’inhu l-progress tal-lista ta’ kontroll tiegħi?",
  nl: "Wat is de voortgang van mijn checklist?",
  pl: "Co zostało na mojej liście kontrolnej?",
  pt: "Qual é o progresso da minha lista de verificação?",
  ro: "Care este progresul listei mele de verificare?",
  ru: "Какой прогресс у моего контрольного списка?",
  sk: "Aký je môj pokrok v mojom kontrolnom zozname?",
  sl: "Kakšen je moj napredek na mojem kontrolnem seznamu?",
  sv: "Vad är status på min checklista?",
  tr: "Kontrol listesi ilerlemem nedir?",
  zh: "我的清单进度如何？"
};

const NATURAL_SAVED_DATE_REQUESTS = {
  ar: "ما هو تاريخ الاستحقاق في قائمة التحقق الخاصة بي؟",
  bg: "Каква е крайната дата в моя контролен списък?",
  bn: "আমার চেকলিস্ট শেষ তারিখ কী?",
  cs: "Jaké je datum splatnosti mého kontrolního seznamu?",
  da: "Hvad er forfaldsdatoen på min tjekliste?",
  de: "Wann ist das Fälligkeitsdatum auf meiner Checkliste?",
  el: "Ποια είναι η ημερομηνία της λίστας ελέγχου μου;",
  en: "What is the due date on my TPS checklist?",
  es: "¿Cuál es la fecha límite en mi lista de verificación?",
  et: "Mis on minu kontrollnimekirja tähtaeg?",
  fi: "Mikä on tarkistuslistani määräpäivä?",
  fr: "Quelle est la date limite de ma liste de contrôle ?",
  ga: "Cad é spriocdháta mo sheicliosta?",
  hi: "मेरी चेकलिस्ट की अंतिम तारीख क्या है?",
  hr: "Koji je rok moje kontrolne liste?",
  hu: "Mi az ellenőrzőlistám határideje?",
  it: "Qual è la scadenza della mia checklist?",
  lt: "Kokia mano kontrolinio sąrašo termino data?",
  lv: "Kāds ir mana kontrolsaraksta termiņš?",
  mt: "X'inhi d-data tal-iskadenza tal-lista ta' kontroll tiegħi?",
  nl: "Wat is de vervaldatum op mijn checklist?",
  pl: "Jaki jest termin na mojej liście kontrolnej?",
  pt: "Qual é a data limite na minha lista de verificação?",
  ro: "Care este termenul din lista mea de verificare?",
  ru: "Какая дата у моего контрольного списка?",
  sk: "Aký je termín v mojom kontrolnom zozname?",
  sl: "Kateri datum je v mojem kontrolnem seznamu?",
  sv: "Vilket datum står på min checklista?",
  tr: "Kontrol listem için son tarih nedir?",
  zh: "我的清单截止日期是什么？"
};

const GENERAL_RESEARCH_REQUESTS = {
  ar: "أنشئ قائمة تحقق عامة لتأشيرة الهجرة واشرح المتطلبات.",
  bg: "Създай общ контролен списък за имиграционна виза и обясни изискванията.",
  bn: "অভিবাসী ভিসার জন্য একটি সাধারণ চেকলিস্ট ও যোগ্যতার নিয়ম বুঝিয়ে দিন।",
  cs: "Vytvoř obecný kontrolní seznam pro imigrační vízum a vysvětli podmínky.",
  da: "Lav en generel tjekliste til et immigrantvisum og forklar kravene.",
  de: "Erstelle eine allgemeine Checkliste für ein Einwanderungsvisum und erkläre die Voraussetzungen.",
  el: "Δημιούργησε μια γενική λίστα ελέγχου για μεταναστευτική βίζα και εξήγησε τις προϋποθέσεις.",
  en: "Create a general immigrant-visa checklist and explain the eligibility requirements.",
  es: "Crea una lista de verificación general para una visa de inmigrante y explica los requisitos.",
  et: "Koosta sisserändaja viisa üldine kontrollnimekiri ja selgita nõudeid.",
  fi: "Tee yleinen tarkistuslista maahanmuuttajaviisumia varten ja selitä vaatimukset.",
  fr: "Crée une liste de contrôle générale pour un visa d’immigrant et explique les conditions.",
  ga: "Cruthaigh seicliosta ginearálta do víosa inimirceach agus mínigh na riachtanais.",
  hi: "आप्रवासी वीज़ा के लिए सामान्य चेकलिस्ट बनाएँ और पात्रता समझाएँ।",
  hr: "Napravi opću kontrolnu listu za useljeničku vizu i objasni uvjete.",
  hu: "Készíts általános ellenőrzőlistát bevándorló vízumhoz, és magyarázd el a feltételeket.",
  it: "Crea una lista di controllo generale per un visto d’immigrazione e spiega i requisiti.",
  lt: "Sudaryk bendrą imigracinės vizos kontrolinį sąrašą ir paaiškink reikalavimus.",
  lv: "Izveido vispārīgu imigrācijas vīzas kontrolsarakstu un izskaidro prasības.",
  mt: "Oħloq lista ta’ kontroll ġenerali għal viża ta’ immigrant u spjega r-rekwiżiti.",
  nl: "Maak een algemene checklist voor een immigrantenvisum en leg de voorwaarden uit.",
  pl: "Utwórz ogólną listę kontrolną dla wizy imigracyjnej i wyjaśnij wymagania.",
  pt: "Crie uma lista de verificação geral para visto de imigrante e explique os requisitos.",
  ro: "Creează o listă generală de verificare pentru viza de imigrare și explică cerințele.",
  ru: "Составь общий контрольный список для иммиграционной визы и объясни требования.",
  sk: "Vytvor všeobecný kontrolný zoznam pre prisťahovalecké vízum a vysvetli podmienky.",
  sl: "Pripravi splošen kontrolni seznam za priseljenski vizum in pojasni pogoje.",
  sv: "Skapa en allmän checklista för immigrantvisum och förklara kraven.",
  tr: "Göçmen vizesi için genel bir kontrol listesi oluştur ve şartları açıkla.",
  zh: "请制作一份移民签证通用清单，并解释资格要求。"
};

test("the exact progress and checklist UI prompts stay local in all 30 locales", () => {
  assert.equal(SHIPPED_LOCALES.length, 30);

  for (const locale of SHIPPED_LOCALES) {
    for (const prompt of uiPromptsFor(locale)) {
      assert.equal(
        isExplicitSavedChecklistSummary(
          prompt,
          uiPromptsFor(locale),
          locale,
          { trustedPreset: true }
        ),
        true,
        `${locale}: ${prompt}`
      );
    }
  }
});

test("typed generic UI text is not trusted merely because it matches a button", () => {
  for (const locale of ["es", "fr"]) {
    const prompt = uiPromptsFor(locale)[0];
    assert.equal(
      isExplicitSavedChecklistSummary(prompt, uiPromptsFor(locale), locale),
      false,
      `${locale}: ${prompt}`
    );
    assert.equal(
      isExplicitSavedChecklistSummary(
        prompt,
        uiPromptsFor(locale),
        locale,
        { trustedPreset: true }
      ),
      true,
      `${locale}: trusted preset ${prompt}`
    );
  }
});

test("natural requests must explicitly refer to the user's checklist in all 30 locales", () => {
  const failures = [];
  for (const locale of SHIPPED_LOCALES) {
    const request = NATURAL_SAVED_CHECKLIST_REQUESTS[locale];
    if (!isExplicitSavedChecklistSummary(request, uiPromptsFor(locale), locale)) {
      failures.push(`${locale}: ${request}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("saved-date lookup cannot swallow a general deadline question", () => {
  const legalDeadlineQuestions = {
    en: "What is the TPS renewal deadline?",
    es: "¿Cuál es la fecha límite para renovar el TPS?",
    fr: "Quelle est la date limite de renouvellement du TPS ?",
    de: "Wann ist die Frist für die TPS-Verlängerung?",
    ar: "ما الموعد النهائي لتجديد TPS؟",
    hi: "TPS नवीनीकरण की अंतिम तिथि क्या है?",
    zh: "TPS 续期的截止日期是什么时候？"
  };

  for (const [locale, question] of Object.entries(legalDeadlineQuestions)) {
    assert.equal(shouldHandleSavedChecklistDateQuery({
      question,
      locale,
      hasFlow: true,
      hasDateNoun: true,
      explicitQuestion: true,
      hasDateLiteral: false
    }), false, `${locale}: ${question}`);
  }

  assert.equal(shouldHandleSavedChecklistDateQuery({
    question: "What is the due date on my TPS checklist?",
    locale: "en",
    hasFlow: true,
    hasDateNoun: true,
    explicitQuestion: true,
    hasDateLiteral: false
  }), true);

  assert.equal(shouldHandleSavedChecklistDateQuery({
    question: "Does my TPS checklist use the correct USCIS filing deadline?",
    locale: "en",
    hasFlow: true,
    hasDateNoun: true,
    explicitQuestion: true,
    hasDateLiteral: false
  }), false);

  for (const question of [
    "What is the due date on my TPS checklist; what is the due date on my EAD checklist?",
    "What is the due date on my TPS checklist and my EAD checklist?",
    "What is the due date on my TPS checklist, my travel authorization checklist?",
    "What is the due date on my TPS checklist / my travel authorization checklist?",
    "What is the due date on my TPS checklist (my travel authorization checklist)?",
    "What is the due date on my TPS checklist. What target date is saved for my checklist?",
    "When is my TPS checklist due date, and am I still eligible?",
    "When is my TPS checklist due date and am I still eligible?",
    "What is the correct USCIS filing deadline for my TPS checklist?",
    "What deadline governs my TPS checklist under the latest TPS extension?"
  ]) {
    assert.equal(shouldHandleSavedChecklistDateQuery({
      question,
      locale: "en",
      hasFlow: true,
      hasDateNoun: true,
      explicitQuestion: true,
      hasDateLiteral: false
    }), false, question);
  }
});

test("saved-date lookup rejects compound and multi-flow questions in all 30 locales", () => {
  for (const [locale, question] of Object.entries(NATURAL_SAVED_DATE_REQUESTS)) {
    const input = {
      locale,
      hasFlow: true,
      hasDateNoun: true,
      explicitQuestion: true,
      hasDateLiteral: false
    };
    assert.equal(
      shouldHandleSavedChecklistDateQuery({
        ...input,
        question: `${question.replace(/[?？؟]\s*$/u, "")} ; TPS? EAD?`
      }),
      false,
      locale
    );
  }
});

test("simple saved-date retrieval is allowlisted and extra legal context uses AI in all 30 locales", () => {
  assert.deepEqual(
    Object.keys(NATURAL_SAVED_DATE_REQUESTS).sort(),
    [...SHIPPED_LOCALES].sort()
  );

  for (const [locale, question] of Object.entries(NATURAL_SAVED_DATE_REQUESTS)) {
    const input = {
      question,
      locale,
      hasFlow: true,
      hasDateNoun: true,
      explicitQuestion: true,
      hasDateLiteral: false
    };
    assert.equal(shouldHandleSavedChecklistDateQuery(input), true, `${locale}: ${question}`);
    assert.equal(shouldHandleSavedChecklistDateQuery({
      ...input,
      question: `${question} EB-5 eligibility under current law`
    }), false, `${locale}: legal context must use AI`);
  }
});

test("typed messages cannot trigger navigation or checklist mutations", () => {
  const falseRouteRegressions = [
    ["Show me if I qualify for TPS.", false],
    ["Is my EAD still valid after 2025-04-02?", false],
    ["Why did USCIS create a TPS reminder that says my deadline is tomorrow?", true],
    ["I have passport photos for TPS. Are they acceptable for filing?", false],
    ["What evidence do I still need for my EAD renewal?", true],
    ["Why did my TPS checklist reset after the update?", true],
    ["What can you do if USCIS denies my green card?", true]
  ];

  for (const [question] of falseRouteRegressions) {
    const savedSummary = isExplicitSavedChecklistSummary(question, [], "en");
    const savedDateQuery = shouldHandleSavedChecklistDateQuery({
      question,
      locale: "en",
      hasFlow: true,
      hasDateNoun: true,
      explicitQuestion: true,
      hasDateLiteral: /\b\d{4}-\d{2}-\d{2}\b/u.test(question)
    });
    assert.equal(localCasePilotReadIntent({ savedSummary, savedDateQuery }), null, question);
  }

  assert.equal(localCasePilotReadIntent({ savedSummary: true }), "saved-summary");
  assert.equal(localCasePilotReadIntent({ savedDateQuery: true }), "saved-date");
});

test("general visa-checklist research never becomes saved progress in any locale", () => {
  for (const locale of SHIPPED_LOCALES) {
    const request = GENERAL_RESEARCH_REQUESTS[locale];
    assert.equal(
      isExplicitSavedChecklistSummary(request, uiPromptsFor(locale), locale),
      false,
      `${locale}: ${request}`
    );
  }
});

test("a second route or eligibility intent forces research in all 30 locales", () => {
  for (const locale of SHIPPED_LOCALES) {
    const request = `${NATURAL_SAVED_CHECKLIST_REQUESTS[locale]} EB-5 visa eligibility`;
    assert.equal(
      isExplicitSavedChecklistSummary(request, uiPromptsFor(locale), locale),
      false,
      `${locale}: ${request}`
    );
  }
});

test("a summary request naming more than one saved flow goes to CasePilot", () => {
  for (const question of [
    "What is my TPS checklist progress, EAD progress?",
    "What is my TPS checklist progress, travel authorization progress?",
    "My TPS checklist status, EAD status"
  ]) {
    assert.equal(
      isExplicitSavedChecklistSummary(question, [], "en", { matchedFlowCount: 2 }),
      false,
      question
    );
  }
});

test("personalized relocation and eligibility questions always use research", () => {
  const questions = [
    "I am an Italian citizen living in Portugal and I want to move to the USA. Where do I start and what do I need to do?",
    "What steps do I need to move to the United States?",
    "What do I need for a U.S. work permit?",
    "Where should my family start if we want to immigrate?",
    "Can I move to America and work there?"
  ];

  for (const question of questions) {
    assert.equal(
      isExplicitSavedChecklistSummary(question, uiPromptsFor("en"), "en"),
      false,
      question
    );
  }
});

test("known false routes and substring collisions remain on the research path", () => {
  const cases = [
    ["en", "What is my progress for naturalization?"],
    ["en", "Show my visa checklist progress."],
    ["en", "I understand the general visa checklist and progress requirements."],
    ["de", "I understand the visa checklist requirements."],
    ["de", "Ich möchte den Stand einer allgemeinen Visa-Checkliste verstehen."],
    ["es", "Dame una lista de verificación general para una visa y explica el progreso del proceso."],
    ["it", "Dammi una checklist generale per il visto e spiegami lo stato della procedura."],
    ["en", "TPS progress status"],
    ["en", "Checklist progress summary"]
  ];

  for (const [locale, question] of cases) {
    assert.equal(
      isExplicitSavedChecklistSummary(question, uiPromptsFor(locale), locale),
      false,
      `${locale}: ${question}`
    );
  }
});

test("mixed saved-progress and legal questions are not partially swallowed locally", () => {
  const cases = [
    ["en", "What is my checklist status, and do I qualify for an EB-5 green card?"],
    ["de", "Wie ist der Stand meiner Checkliste und bin ich für ein Arbeitsvisum qualifiziert?"],
    ["es", "¿Cuál es el estado de mi lista de verificación y califico para una visa de trabajo?"],
    ["it", "Qual è lo stato della mia checklist e posso ottenere un visto di lavoro?"],
    ["zh", "我的清单进度如何，我是否符合美国工作签证资格？"]
  ];

  for (const [locale, question] of cases) {
    assert.equal(
      isExplicitSavedChecklistSummary(question, uiPromptsFor(locale), locale),
      false,
      `${locale}: ${question}`
    );
  }
});

test("language rules are scoped to the active locale", () => {
  assert.equal(
    isExplicitSavedChecklistSummary(
      "I understand my checklist status.",
      uiPromptsFor("de"),
      "de-DE"
    ),
    false
  );
  assert.equal(
    isExplicitSavedChecklistSummary(
      "Was bleibt auf meiner Checkliste?",
      uiPromptsFor("de"),
      "de-DE"
    ),
    true
  );
  assert.equal(
    isExplicitSavedChecklistSummary("my checklist status", [], "xx"),
    false
  );
});

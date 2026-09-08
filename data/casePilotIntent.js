import { normalizeIntentText } from "./aiIntent.js";

/*
 * Saved-checklist summaries are the only conversational requests that bypass
 * CasePilot research. Keep this gate deliberately narrow: a request must name
 * the user's own/saved checklist in the active language and ask for its
 * progress. Exact UI prompts are trusted because the app generated them.
 *
 * Do not pool these terms across languages. Short words such as German
 * "Stand" are meaningful only in their locale and must be matched as tokens,
 * never as substrings (for example, inside English "understand").
 */
const SAVED_CHECKLIST_RULES = {
  ar: {
    owned: ["قائمتي", "قائمة التحقق الخاصة بي", "قائمة التحقق المحفوظة"],
    progress: ["تقدم", "التقدم", "حالة", "ما المتبقي", "ماذا تبقى", "ملخص"]
  },
  bg: {
    owned: ["контролния ми списък", "моя контролен списък", "запазения ми контролен списък"],
    progress: ["напредък", "какво остава", "какво е завършено", "състояние", "обобщение"]
  },
  bn: {
    owned: ["আমার চেকলিস্ট", "আমার যাচাই তালিকা", "আমার সংরক্ষিত চেকলিস্ট"],
    progress: ["অগ্রগতি", "কী বাকি", "কি বাকি", "অবস্থা", "সারাংশ"]
  },
  cs: {
    owned: ["mého kontrolního seznamu", "můj kontrolní seznam", "můj uložený kontrolní seznam"],
    progress: ["postup", "co zbývá", "kolik je hotovo", "stav", "shrnutí"]
  },
  da: {
    owned: ["min tjekliste", "mine tjeklistefremskridt", "min gemte tjekliste"],
    progress: ["fremskridt", "status", "hvad mangler", "hvad er tilbage", "opsummering"]
  },
  de: {
    owned: ["meine checkliste", "meiner checkliste", "mein checklistenfortschritt", "meine gespeicherte checkliste"],
    progress: ["fortschritt", "stand", "status", "was bleibt", "noch offen", "übersicht"]
  },
  el: {
    owned: ["της λίστας ελέγχου μου", "η λίστα ελέγχου μου", "την αποθηκευμένη λίστα ελέγχου μου"],
    progress: ["πρόοδος", "τι απομένει", "τι έχει μείνει", "κατάσταση", "σύνοψη"]
  },
  en: {
    owned: [
      "my checklist",
      "my saved checklist",
      "saved checklist",
      "my tps checklist",
      "my ead checklist",
      "my travel authorization checklist"
    ],
    progress: [
      "progress", "status", "summary", "what is left", "what s left",
      "what remains", "still left", "still need", "completed"
    ]
  },
  es: {
    owned: ["mi lista de verificación", "mi lista de control", "mis listas", "mi lista guardada"],
    progress: ["progreso", "estado", "qué falta", "que falta", "qué queda", "que queda", "resumen"]
  },
  et: {
    owned: ["minu kontrollnimekiri", "minu kontrollnimekirja", "minu salvestatud kontrollnimekiri"],
    progress: ["edenemine", "mis on tehtud", "mis on jäänud", "olek", "kokkuvõte"]
  },
  fi: {
    owned: ["tarkistuslistani", "minun tarkistuslistani", "tallennettu tarkistuslistani"],
    progress: ["edistyminen", "tila", "mitä on jäljellä", "mitä on tehty", "yhteenveto"]
  },
  fr: {
    owned: ["ma liste de contrôle", "ma liste enregistrée", "ma checklist"],
    progress: ["progression", "statut", "quel est le statut", "que reste", "ce qui reste", "résumé"]
  },
  ga: {
    owned: ["mo sheicliosta", "mo seicliosta", "mo sheicliosta sábháilte"],
    progress: ["dul chun cinn", "cad atá fágtha", "cé mhéad atá déanta", "stádas", "achoimre"]
  },
  hi: {
    owned: ["मेरी चेकलिस्ट", "मेरी जांच सूची", "मेरी सहेजी गई चेकलिस्ट"],
    progress: ["प्रगति", "स्थिति", "क्या बाकी", "क्या बचा", "सारांश", "पूरा"]
  },
  hr: {
    owned: ["moje kontrolne liste", "moja kontrolna lista", "moja spremljena kontrolna lista"],
    progress: ["napredak", "što je preostalo", "sto je preostalo", "koliko je gotovo", "stanje", "sažetak"]
  },
  hu: {
    owned: ["ellenőrzőlistám", "az ellenőrzőlistám", "a mentett ellenőrzőlistám"],
    progress: ["haladás", "állás", "állása", "mi van hátra", "mi maradt", "állapot", "összegzés"]
  },
  it: {
    owned: ["mia checklist", "mia lista di controllo", "mie liste", "mia checklist salvata"],
    progress: ["progresso", "stato", "cosa manca", "quanto manca", "a che punto", "riepilogo"]
  },
  lt: {
    owned: ["mano kontrolinio sąrašo", "mano kontrolinis sąrašas", "mano išsaugotas kontrolinis sąrašas"],
    progress: ["pažanga", "kas liko", "kas atlikta", "būsena", "santrauka"]
  },
  lv: {
    owned: ["mans kontrolsaraksts", "mana kontrolsaraksta", "mans saglabātais kontrolsaraksts"],
    progress: ["progress", "kas atlicis", "kas jau pabeigts", "kā iet", "statuss", "kopsavilkums"]
  },
  mt: {
    owned: ["il lista ta kontroll tiegħi", "lista ta kontroll tiegħi", "il lista ta kontroll salvata tiegħi"],
    progress: ["progress", "x fadal", "x inhu fadal", "status", "sommarju"]
  },
  nl: {
    owned: ["mijn checklist", "mijn opgeslagen checklist"],
    progress: ["voortgang", "status", "wat blijft over", "wat is over", "overgebleven", "samenvatting"]
  },
  pl: {
    owned: ["mojej listy kontrolnej", "mojej liście kontrolnej", "moja lista kontrolna", "mojej zapisanej listy kontrolnej"],
    progress: ["postęp", "co zostało", "co pozostało", "stan", "podsumowanie"]
  },
  pt: {
    owned: ["minha lista de verificação", "da minha lista de verificação", "minha lista de controlo", "minhas listas", "minha lista salva"],
    progress: ["progresso", "estado", "o que falta", "o que resta", "resumo"]
  },
  ro: {
    owned: ["listei mele de verificare", "lista mea de verificare", "lista mea salvată"],
    progress: ["progres", "progresul", "stare", "ce a rămas", "ce mai rămâne", "rezumat"]
  },
  ru: {
    owned: ["мой контрольный список", "моего контрольного списка", "мой сохраненный контрольный список", "мой чеклист"],
    progress: ["прогресс", "статус", "что осталось", "что выполнено", "сводка"]
  },
  sk: {
    owned: ["mojom kontrolnom zozname", "môj kontrolný zoznam", "môj uložený kontrolný zoznam"],
    progress: ["pokrok", "stav", "čo zostáva", "čo je hotové", "zhrnutie"]
  },
  sl: {
    owned: ["mojem kontrolnem seznamu", "moj kontrolni seznam", "moj shranjeni kontrolni seznam"],
    progress: ["napredek", "kaj je ostalo", "kaj še manjka", "stanje", "povzetek"]
  },
  sv: {
    owned: ["min checklista", "min sparade checklista"],
    progress: ["status", "framsteg", "vad återstår", "hur långt", "sammanfattning"]
  },
  tr: {
    owned: ["kontrol listem", "benim kontrol listem", "kayıtlı kontrol listem", "kontrol listesi ilerlemem"],
    progress: ["ilerleme", "ilerlemem", "durum", "ne kaldı", "ne kaldi", "özet"]
  },
  zh: {
    owned: ["我的清单", "我保存的清单", "我的核对清单"],
    progress: ["进度", "状态", "还剩", "剩下什么", "完成了什么", "摘要"]
  }
};

const NON_SPACED_SCRIPT = /\p{Script=Han}/u;
const SAFE_FLOW_TERMS = ["tps", "ead", "765", "131"];
const SAVED_FLOW_MARKERS = Object.freeze({
  tps: Object.freeze(["tps", "temporary protected status"]),
  ead: Object.freeze(["ead", "i 765", "work permit", "employment authorization"]),
  travel: Object.freeze([
    "travel authorization", "advance parole", "travel document", "i 131", "travel permit"
  ])
});
const MIN_SAFE_TOKEN_COVERAGE = 1;
const MAX_NATURAL_REQUEST_TOKENS = 18;

const SAVED_DATE_QUESTION_MARKERS = Object.freeze({
  ar: ["ما", "متى"], bg: ["каква", "кога", "кой"],
  bn: ["কী", "কি", "কখন"], cs: ["jaké", "jaký", "kdy", "co"],
  da: ["hvad", "hvornår"], de: ["was", "wann", "welche"],
  el: ["ποια", "πότε", "τι"], en: ["what", "when"],
  es: ["cuál", "cual", "cuándo", "cuando", "qué", "que"],
  et: ["mis", "millal"], fi: ["mikä", "milloin"],
  fr: ["quelle", "quel", "quand"], ga: ["cad", "cén", "cathain"],
  hi: ["क्या", "कब", "कौन"], hr: ["koji", "koja", "kada", "što"],
  hu: ["mi", "mikor", "melyik"], it: ["qual è", "quale", "quando"],
  lt: ["kokia", "kada"], lv: ["kāds", "kāda", "kad"],
  mt: ["x inhi", "meta", "liema"], nl: ["wat", "wanneer", "welke"],
  pl: ["jaki", "jaka", "kiedy", "co"], pt: ["qual", "quando", "que"],
  ro: ["care", "când", "cand", "ce"], ru: ["какая", "какой", "когда", "что"],
  sk: ["aký", "aká", "kedy", "čo"], sl: ["kateri", "kakšen", "kdaj", "kaj"],
  sv: ["vilket", "vilken", "när", "vad"], tr: ["ne", "nedir", "hangi", "ne zaman"],
  zh: ["什么", "何时", "什么时候", "哪天"]
});

/*
 * Local date handling is an allowlist, not a legal-topic denylist. Every word
 * (or, for Han text, every character) in a typed request must be covered by a
 * known simple saved-date lookup for the active locale. Any qualification,
 * current-law premise, second question, or other extra language goes to AI.
 */
const SIMPLE_SAVED_DATE_LOOKUPS = Object.freeze({
  ar: ["ما هو تاريخ الاستحقاق في قائمة التحقق الخاصة بي"],
  bg: ["Каква е крайната дата в моя контролен списък"],
  bn: ["আমার চেকলিস্ট শেষ তারিখ কী"],
  cs: ["Jaké je datum splatnosti mého kontrolního seznamu"],
  da: ["Hvad er forfaldsdatoen på min tjekliste"],
  de: ["Wann ist das Fälligkeitsdatum auf meiner Checkliste"],
  el: ["Ποια είναι η ημερομηνία της λίστας ελέγχου μου"],
  en: [
    "What is the due date on my TPS checklist",
    "When is the due date on my saved checklist",
    "What target date is saved for my checklist"
  ],
  es: ["Cuál es la fecha límite en mi lista de verificación"],
  et: ["Mis on minu kontrollnimekirja tähtaeg"],
  fi: ["Mikä on tarkistuslistani määräpäivä"],
  fr: ["Quelle est la date limite de ma liste de contrôle"],
  ga: ["Cad é spriocdháta mo sheicliosta"],
  hi: ["मेरी चेकलिस्ट की अंतिम तारीख क्या है"],
  hr: ["Koji je rok moje kontrolne liste"],
  hu: ["Mi az ellenőrzőlistám határideje"],
  it: ["Qual è la scadenza della mia checklist"],
  lt: ["Kokia mano kontrolinio sąrašo termino data"],
  lv: ["Kāds ir mana kontrolsaraksta termiņš"],
  mt: ["X'inhi d-data tal-iskadenza tal-lista ta' kontroll tiegħi"],
  nl: ["Wat is de vervaldatum op mijn checklist"],
  pl: ["Jaki jest termin na mojej liście kontrolnej"],
  pt: ["Qual é a data limite na minha lista de verificação"],
  ro: ["Care este termenul din lista mea de verificare"],
  ru: ["Какая дата у моего контрольного списка"],
  sk: ["Aký je termín v mojom kontrolnom zozname"],
  sl: ["Kateri datum je v mojem kontrolnem seznamu"],
  sv: ["Vilket datum står på min checklista"],
  tr: ["Kontrol listem için son tarih nedir"],
  zh: ["我的清单截止日期是什么"]
});

const localeKey = (locale) => String(locale || "en").toLowerCase().split(/[-_]/)[0];

const containsWholePhrase = (normalizedText, rawPhrase) => {
  const phrase = normalizeIntentText(rawPhrase);
  if (!phrase) return false;

  if (NON_SPACED_SCRIPT.test(phrase)) {
    return normalizedText.includes(phrase);
  }

  return ` ${normalizedText} `.includes(` ${phrase} `);
};

const normalizePrompts = (localizedPrompts) => (
  Array.isArray(localizedPrompts) ? localizedPrompts : []
)
  .map(normalizeIntentText)
  .filter(Boolean);

const hasOnlyKnownVocabulary = (normalized, phrases) => {
  const safePhrases = phrases
    .map(normalizeIntentText)
    .filter(Boolean);

  if (NON_SPACED_SCRIPT.test(normalized)) {
    if (normalized.length > 36) return false;

    const covered = Array.from({ length: normalized.length }, () => false);
    for (const phrase of safePhrases) {
      let start = normalized.indexOf(phrase);
      while (start >= 0) {
        for (let index = start; index < start + phrase.length; index += 1) {
          covered[index] = true;
        }
        start = normalized.indexOf(phrase, start + 1);
      }
    }
    return covered.filter(Boolean).length / normalized.length >= MIN_SAFE_TOKEN_COVERAGE;
  }

  const queryTokens = normalized.split(" ").filter(Boolean);
  if (queryTokens.length > MAX_NATURAL_REQUEST_TOKENS) return false;

  const safeTokens = new Set(
    safePhrases.flatMap((phrase) => phrase.split(" ").filter(Boolean))
  );
  const coveredCount = queryTokens.filter((token) => safeTokens.has(token)).length;
  return coveredCount / queryTokens.length >= MIN_SAFE_TOKEN_COVERAGE;
};

const hasSafeVocabularyCoverage = (normalized, rules, prompts) =>
  hasOnlyKnownVocabulary(normalized, [
    ...rules.owned,
    ...rules.progress,
    ...prompts,
    ...SAFE_FLOW_TERMS
  ]);

const namesOwnedSavedChecklist = (question, locale = "en") => {
  const normalized = normalizeIntentText(question);
  const rules = SAVED_CHECKLIST_RULES[localeKey(locale)];
  if (!normalized || !rules) return false;
  return rules.owned.some((phrase) => containsWholePhrase(normalized, phrase));
};

const asksDirectSavedDateLookup = (question, locale = "en") => {
  const normalized = normalizeIntentText(question);
  const markers = SAVED_DATE_QUESTION_MARKERS[localeKey(locale)] || [];
  return markers.some((marker) => containsWholePhrase(normalized, marker));
};

const isSimpleSavedDateLookup = (question, locale = "en") => {
  const rawQuestion = String(question || "");
  const normalized = normalizeIntentText(question);
  if (!normalized) return false;
  const key = localeKey(locale);

  // A local lookup can answer one saved date only. Multiple questions,
  // semicolon-separated clauses, or multiple named flows need a composed AI
  // response instead of silently collapsing into one checklist date.
  const questionMarks = rawQuestion.match(/[?？؟]/gu) || [];
  const semicolons = rawQuestion.match(/[;；]/gu) || [];
  const singleGreekQuestionMark = key === "el" &&
    semicolons.length === 1 &&
    /;\s*$/u.test(rawQuestion);
  if (
    questionMarks.length > 1 ||
    /[\n\r]/u.test(rawQuestion) ||
    (semicolons.length > 0 && !singleGreekQuestionMark) ||
    /[.!。！]\s+(?=\p{L})/u.test(rawQuestion)
  ) return false;
  const inferredFlowKeys = Object.entries(SAVED_FLOW_MARKERS)
    .filter(([, markers]) => markers.some((term) => containsWholePhrase(normalized, term)))
    .map(([flowKey]) => flowKey);
  if (inferredFlowKeys.length > 1) return false;

  const rules = SAVED_CHECKLIST_RULES[key];
  const lookupExamples = SIMPLE_SAVED_DATE_LOOKUPS[key];
  if (!rules || !lookupExamples) return false;

  return hasOnlyKnownVocabulary(normalized, [
    ...rules.owned,
    ...SAVED_DATE_QUESTION_MARKERS[key],
    ...lookupExamples,
    ...SAFE_FLOW_TERMS
  ]);
};

export function shouldHandleSavedChecklistDateQuery({
  question,
  locale = "en",
  hasFlow = false,
  hasDateNoun = false,
  explicitQuestion = false,
  hasDateLiteral = false,
  matchedFlowCount
} = {}) {
  return Boolean(
    hasFlow &&
    (!Number.isInteger(matchedFlowCount) || matchedFlowCount === 1) &&
    hasDateNoun &&
    explicitQuestion &&
    !hasDateLiteral &&
    namesOwnedSavedChecklist(question, locale) &&
    asksDirectSavedDateLookup(question, locale) &&
    isSimpleSavedDateLookup(question, locale)
  );
}

export function localCasePilotReadIntent({
  savedSummary = false,
  savedDateQuery = false
} = {}) {
  if (savedSummary) return "saved-summary";
  if (savedDateQuery) return "saved-date";
  return null;
}

export function isExplicitSavedChecklistSummary(
  question,
  localizedPrompts = [],
  locale = "en",
  { trustedPreset = false, matchedFlowCount = 0 } = {}
) {
  const normalized = normalizeIntentText(question);
  if (!normalized) return false;
  if (Number(matchedFlowCount) > 1) return false;

  // These strings came from buttons in the current UI, so equality is enough
  // and avoids interpreting fragments from another language.
  const prompts = normalizePrompts(localizedPrompts);
  if (trustedPreset && prompts.some((prompt) => normalized === prompt)) {
    return true;
  }

  const rules = SAVED_CHECKLIST_RULES[localeKey(locale)];
  if (!rules) return false;

  const namesOwnedChecklist = namesOwnedSavedChecklist(normalized, locale);
  if (!namesOwnedChecklist) return false;

  const asksForProgress = rules.progress.some((phrase) =>
    containsWholePhrase(normalized, phrase)
  );
  if (!asksForProgress) return false;

  // Substantial vocabulary beyond the saved-checklist request can signal a
  // second eligibility or route question. Let AI handle the whole sentence.
  return hasSafeVocabularyCoverage(normalized, rules, prompts);
}

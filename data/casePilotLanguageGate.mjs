import { francAll } from "franc";

const SCRIPT_REQUIREMENTS = Object.freeze({
  ar: /\p{Script=Arabic}/u,
  bg: /\p{Script=Cyrillic}/u,
  bn: /\p{Script=Bengali}/u,
  el: /\p{Script=Greek}/u,
  hi: /\p{Script=Devanagari}/u,
  ru: /\p{Script=Cyrillic}/u,
  zh: /\p{Script=Han}/u
});

const JAPANESE_KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const MIN_STATISTICAL_LETTERS = 20;
const MAX_STATISTICAL_SCORE_GAP = 0.015;

const FRANC_LANGUAGE_CODES = Object.freeze({
  ar: "arb", bg: "bul", bn: "ben", cs: "ces", da: "dan", de: "deu",
  el: "ell", en: "eng", es: "spa", et: "ekk", fi: "fin", fr: "fra",
  hi: "hin", hr: "hrv", hu: "hun", it: "ita", lt: "lit", lv: "lvs",
  nl: "nld", pl: "pol", pt: "por", ro: "ron", ru: "rus", sk: "slk",
  sl: "slv", sv: "swe", tr: "tur", zh: "cmn"
});

// Franc does not reliably distinguish these two on short legal prose. Their
// dedicated word-marker checks below are more accurate for our fixed set.
const CUSTOM_ONLY_LANGUAGE_CODES = new Set(["ga", "mt"]);

const ENGLISH_PROSE_MARKERS = new Set([
  "a", "about", "according", "after", "also", "an", "and", "answer", "apply",
  "approval", "are", "as", "at", "avenues", "based", "because", "before", "being",
  "been", "but", "by", "can", "circumstances", "citizen", "compare", "consult", "could",
  "current", "depending", "diversity", "eligibility", "employment", "evidence", "family",
  "filing", "first", "for", "from", "had", "has", "have", "here", "however", "if",
  "immigration", "important", "in", "investment", "is", "lawyer", "lottery", "may",
  "might", "must", "need", "needs", "next", "no", "not", "of", "official", "on",
  "or", "page", "practical", "relevant", "requirements", "residing", "several", "should",
  "situation", "sponsorship", "step", "that", "the", "their", "then", "there", "these",
  "this", "those", "timing", "to", "verify", "was", "were", "what", "when", "where",
  "which", "while", "who", "will", "with", "without", "would", "you", "your", "yours"
]);

const LATIN_LANGUAGE_MARKERS = Object.freeze(Object.fromEntries(
  Object.entries({
    tr: "ve bir bu için ile veya ancak ama sizin size önce sonra olarak gerekir olabilir değil ise hangi",
    es: "que para como pero debe puede usted ustedes su sus los las una por del esta este estos estas desde porque soy ciudadano ciudadana solicitud solicitudes guía mudarme empiezo empieza",
    fr: "vous votre vos une des les du dans pour avec cette ce ces peut devez mais aux sur selon sans",
    pt: "você vocês seu sua seus suas uma para com dos das pode deve esta este pelo pela mas como porque sou cidadão cidadã pedido pedidos requerimento requerimentos não mudar-me começo começar onde apresentar",
    it: "che per con una del della può deve suo sua suoi gli nel nella questa questo quindi senza perché sono vivo voglio dove domanda dipende dalle prove",
    hr: "je su za koji koja vaše vaš može treba ali ili ako da od do prema biste trebali talijanski državljanin živim želim preseliti odakle počnem ovisi dostavljenim dokazima",
    cs: "je jsou pro který která vaše váš může musíte ale nebo pokud podle bez také proto jsem žiji chci kde mám",
    da: "du din dit dine en et den det der som for med kan skal bør men eller hvis uden også",
    nl: "de het een van voor uw u kunt moet met naar als niet dat die deze op en maar wordt zijn omdat",
    et: "teie te see seda jaoks ning või kuid kui võib peab ilma järgi kohta on mis olen elan tahan millest",
    fi: "sinun teidän tämä sitä varten kanssa voi pitää tulee mutta tai jos ilman mukaan sekä joka olen asun haluan mistä ja ovat ei sitten nykyisiä",
    de: "sie ihre ihr ihnen der die das den dem ein eine für mit kann sollte müssen aber oder wenn ohne nach ich bin lebe möchte wo",
    hu: "ön önnek az egy hogy számára kell lehet azonban vagy ha nélkül szerint ezt ettől amely",
    ga: "tú do bhur an na le chun agus ach nó má gan de réir féidir ba chóir braitheann sé fianaise bhfianaise",
    lv: "jūs jūsu tas tā šo šī par ar var vajag bet vai ja bez saskaņā kas ir",
    lt: "jūs jūsų tai šis ši dėl su gali reikia tačiau arba jei be pagal kuris yra esu gyvenu noriu nuo pradėti",
    mt: "inti tiegħek dan din għal ma jista għandek iżda jew jekk mingħajr skont li huwa jien ngħix irrid rrid minn fejn nitlaq nistabbilixxi ruħi nagħmel jiddependi mill provi",
    pl: "pan pani państwa twój twoja jest są dla który która może trzeba należy ale lub jeśli bez według oraz jestem mieszkam chcę czego zacząć",
    ro: "dumneavoastră dvs acest această pentru cu poate trebuie însă sau dacă fără potrivit care este sunt",
    sk: "vy váš vaša vaše je sú pre ktorý ktorá môže musíte treba ale alebo ak bez podľa tiež som žijem chcem kde mám",
    sl: "vi vaš vaša vaše je so za ki katera lahko morate treba vendar ali če brez glede tudi sem živim želim kje naj",
    sv: "du din ditt dina en ett den det som för med kan ska bör men eller om utan enligt också beror på bevisningen"
  }).map(([language, markers]) => [language, new Set(markers.split(" "))])
));

const RELATED_LANGUAGE_SIGNATURES = Object.freeze({
  es: Object.freeze({
    target: new Set("ciudadano ciudadana ciudadanos ciudadanas usted ustedes solicitud solicitudes debe puede guía mudarme empiezo empieza los las del al".split(" ")),
    competing: new Set("cidadão cidadã cidadãos cidadãs você vocês pedido pedidos requerimento requerimentos deve pode não uma umas dos das pelo pela mudar-me começo começar onde apresentar".split(" "))
  }),
  pt: Object.freeze({
    target: new Set("cidadão cidadã cidadãos cidadãs você vocês pedido pedidos requerimento requerimentos deve pode não uma umas dos das pelo pela mudar-me começo começar onde apresentar".split(" ")),
    competing: new Set("ciudadano ciudadana ciudadanos ciudadanas usted ustedes solicitud solicitudes debe puede guía mudarme empiezo empieza los las del al".split(" "))
  })
});

const CYRILLIC_LANGUAGE_SIGNATURES = Object.freeze({
  bg: Object.freeze({
    target: new Set("съм си сме сте са ще няма трябва който която което които вашият вашата вашето ви заявлението пребиваване пребиваването проверете съединените щати бъде бъдат кандидатствате изисквания изискванията официалните първо дават създават трудовите семейните възможности всичко зависи доказателствата".split(" ")),
    competing: new Set("я вы мы это есть нет нужно следует сначала затем который которая которые ваш ваша ваше ваши заявление проживание проверьте соединенные штаты будет будут подать требования официальные дает дают создают трудовые семейные варианты все зависит доказательств".split(" "))
  }),
  ru: Object.freeze({
    target: new Set("я вы мы это есть нет нужно следует сначала затем который которая которые ваш ваша ваше ваши заявление проживание проверьте соединенные штаты будет будут подать требования официальные дает дают создают трудовые семейные варианты все зависит доказательств".split(" ")),
    competing: new Set("съм си сме сте са ще няма трябва който която което които вашият вашата вашето ви заявлението пребиваване пребиваването проверете съединените щати бъде бъдат кандидатствате изисквания изискванията официалните първо дават създават трудовите семейните възможности всичко зависи доказателствата".split(" "))
  })
});

const CUSTOM_LANGUAGE_SIGNATURES = Object.freeze({
  ga: Object.freeze({
    target: new Set("tá ní bhfuil agus ach chun réir féidir chóir saoránacht iodálach phortaingéil aontaithe bealach inimirce fostaíocht infheistíocht teaghlaigh oifigiúla sprioc déan ansin acu braitheann sé fianaise bhfianaise".split(" ")),
    competing: new Set("jeg du din dit dine den det der som for med kan skal bør men eller hvis uden også ikke til af på de dem deres hvor hvad først derefter statsborgerskab bopæl vigtige oplysninger begynd sammenligne krav".split(" "))
  }),
  da: Object.freeze({
    target: new Set("jeg du din dit dine den det der som for med kan skal bør men eller hvis uden også ikke til af på de dem deres hvor hvad først derefter statsborgerskab bopæl vigtige oplysninger begynd sammenligne krav".split(" ")),
    competing: new Set("tá ní bhfuil agus ach chun réir féidir chóir saoránacht iodálach phortaingéil aontaithe bealach inimirce fostaíocht infheistíocht teaghlaigh oifigiúla sprioc déan ansin acu braitheann sé fianaise bhfianaise".split(" "))
  }),
  mt: Object.freeze({
    target: new Set("għal tiegħek jista għandek iżda jew jekk mingħajr skont huwa jien ngħix rrid minn fejn ċittadin taljan portugall l-ewwel imbagħad uffiċjali waħedhom joħolqux għan nitlaq nistabbilixxi ruħi nagħmel applikazzjoni tiddependi mill provi".split(" ")),
    competing: new Set("cittadinanza italiana italiano portogallo famiglia familiari lavoro investimenti investimento requisiti ufficiali prima poi quindi occorre valutare esaminare percorso immigrazione domanda approvazione carta verde".split(" "))
  }),
  it: Object.freeze({
    target: new Set("cittadinanza italiana italiano portogallo famiglia familiari lavoro investimenti investimento requisiti ufficiali prima poi quindi occorre valutare esaminare percorso immigrazione domanda dipende dalle prove approvazione carta verde".split(" ")),
    competing: new Set("għal tiegħek jista għandek iżda jew jekk mingħajr skont huwa jien ngħix rrid minn fejn ċittadin taljan portugall l-ewwel imbagħad uffiċjali waħedhom joħolqux għan nitlaq nistabbilixxi ruħi nagħmel applikazzjoni tiddependi mill provi".split(" "))
  })
});

const ALLOWED_ENGLISH_NAME_PATTERNS = Object.freeze([
  /\b(?:U\.?S\.?|United States) Citizenship and Immigration Services\b/giu,
  /\bUnited States Department of (?:Homeland Security|State|Justice|Labor)\b/giu,
  /\b(?:Department of Homeland Security|Department of State|State Department|Department of Justice|Department of Labor)\b/giu,
  /\b(?:Customs and Border Protection|Immigration and Customs Enforcement|Executive Office for Immigration Review|Board of Immigration Appeals)\b/giu,
  /\bUnited States\b/giu,
  /\b(?:Form\s+)?(?:I|N|G|AR|DS|ETA|EOIR)-?\d{1,4}[A-Z]?\b/giu,
  /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g,
  /\b[A-Z]{2,}\b/g,
  /https?:\/\/\S+/giu
]);

const stripAllowedEnglishNames = (value) => ALLOWED_ENGLISH_NAME_PATTERNS.reduce(
  (text, pattern) => text.replace(pattern, " "),
  String(value || "")
);

export function casePilotResponseLanguageMismatch(language, outputText) {
  const code = String(language || "en").toLowerCase().split(/[-_]/)[0];

  const text = stripAllowedEnglishNames(outputText);
  const letters = [...text].filter((character) => /\p{L}/u.test(character));
  if (!letters.length) return true;

  const targetScript = SCRIPT_REQUIREMENTS[code];
  if (targetScript) {
    const targetLetters = letters.filter((character) => targetScript.test(character)).length;
    if (targetLetters < 6 || targetLetters / letters.length < 0.35) return true;
    if (code === "zh") {
      const kanaLetters = letters.filter((character) => JAPANESE_KANA.test(character)).length;
      if (kanaLetters >= 6 && kanaLetters / letters.length >= 0.08) return true;
    }
  } else {
    const latinLetters = letters.filter((character) => /\p{Script=Latin}/u.test(character)).length;
    if (latinLetters / letters.length < 0.6) return true;
  }

  const lowercaseText = code === "tr"
    ? text.toLocaleLowerCase("tr")
    : text.toLocaleLowerCase();
  const tokens = lowercaseText.match(/\p{L}+(?:['’]\p{L}+)*/gu) || [];
  const englishMarkers = tokens.reduce(
    (count, token) => count + Number(ENGLISH_PROSE_MARKERS.has(token)),
    0
  );
  const preliminaryRequestedLanguageMarkers = LATIN_LANGUAGE_MARKERS[code];
  const preliminaryRequestedLanguageEvidence = preliminaryRequestedLanguageMarkers
    ? tokens.reduce(
      (count, token) => count + Number(preliminaryRequestedLanguageMarkers.has(token)),
      0
    )
    : 0;

  let statisticalDetectorAccepted = false;
  if (
    letters.length >= MIN_STATISTICAL_LETTERS &&
    !CUSTOM_ONLY_LANGUAGE_CODES.has(code) &&
    FRANC_LANGUAGE_CODES[code]
  ) {
    const rankings = francAll(text, { minLength: 10 });
    const [topLanguage, topScore = 0] = rankings[0] || [];
    const expectedScore = rankings.find(([candidate]) =>
      candidate === FRANC_LANGUAGE_CODES[code]
    )?.[1];
    if (topLanguage && topLanguage !== "und") {
      const permittedScoreGap = targetScript ? 0.08 : MAX_STATISTICAL_SCORE_GAP;
      const statisticalScoreGap = Number.isFinite(expectedScore)
        ? topScore - expectedScore
        : Number.POSITIVE_INFINITY;
      const statisticalMismatch = !Number.isFinite(expectedScore) ||
        statisticalScoreGap > permittedScoreGap;
      const strongLexicalOverride = code === "en"
        ? (englishMarkers >= 3 && englishMarkers / Math.max(1, tokens.length) >= 0.3)
        : (
          (preliminaryRequestedLanguageEvidence >= 2 && statisticalScoreGap <= 0.08) ||
          (
            code === "hr" &&
            letters.length <= 60 &&
            preliminaryRequestedLanguageEvidence >= 3 &&
            statisticalScoreGap <= 0.12
          )
        );
      if (statisticalMismatch && !strongLexicalOverride) {
        return true;
      }
      statisticalDetectorAccepted = true;
    }
  }

  if (code === "en") return false;
  if (targetScript) {
    const sameScriptSignature = CYRILLIC_LANGUAGE_SIGNATURES[code];
    if (sameScriptSignature) {
      const targetEvidence = tokens.reduce(
        (count, token) => count + Number(sameScriptSignature.target.has(token)),
        0
      );
      const competingEvidence = tokens.reduce(
        (count, token) => count + Number(sameScriptSignature.competing.has(token)),
        0
      );
      if (competingEvidence >= 2 && competingEvidence >= targetEvidence + 2) return true;
    }
    return englishMarkers >= 5;
  }

  const customSignature = CUSTOM_LANGUAGE_SIGNATURES[code];
  if (customSignature) {
    const targetEvidence = tokens.reduce(
      (count, token) => count + Number(customSignature.target.has(token)),
      0
    );
    const competingEvidence = tokens.reduce(
      (count, token) => count + Number(customSignature.competing.has(token)),
      0
    );
    if (competingEvidence >= 3 && competingEvidence >= targetEvidence + 2) return true;
  }

  const requestedLanguageMarkers = preliminaryRequestedLanguageMarkers;
  if (!requestedLanguageMarkers) return true;
  const requestedLanguageEvidence = preliminaryRequestedLanguageEvidence;
  if (requestedLanguageEvidence < 2 && !statisticalDetectorAccepted) return true;

  const relatedSignature = RELATED_LANGUAGE_SIGNATURES[code];
  if (relatedSignature) {
    const targetEvidence = tokens.reduce(
      (count, token) => count + Number(relatedSignature.target.has(token)),
      0
    );
    const competingEvidence = tokens.reduce(
      (count, token) => count + Number(relatedSignature.competing.has(token)),
      0
    );
    if (competingEvidence >= 2 && competingEvidence >= targetEvidence + 2) return true;
  }

  const distinctiveEvidence = Object.fromEntries(Object.entries(LATIN_LANGUAGE_MARKERS)
    .map(([candidateLanguage, markers]) => {
      const otherMarkers = Object.entries(LATIN_LANGUAGE_MARKERS)
        .filter(([otherLanguage]) => otherLanguage !== candidateLanguage)
        .map(([, otherSet]) => otherSet);
      const score = tokens.reduce((count, token) => count + Number(
        markers.has(token) && !otherMarkers.some((otherSet) => otherSet.has(token))
      ), 0);
      return [candidateLanguage, score];
    }));
  const requestedDistinctiveEvidence = distinctiveEvidence[code] || 0;
  const strongestCompetingDistinctiveEvidence = Math.max(0, ...Object.entries(distinctiveEvidence)
    .filter(([candidateLanguage]) => candidateLanguage !== code)
    .map(([, score]) => score));
  if (strongestCompetingDistinctiveEvidence >= 4 &&
      strongestCompetingDistinctiveEvidence >= requestedDistinctiveEvidence + 3) {
    return true;
  }
  return englishMarkers >= 6 && englishMarkers > requestedLanguageEvidence * 1.25;
}

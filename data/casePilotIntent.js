import { normalizeIntentText } from "./aiIntent.js";

const EXPLICIT_SAVED_CHECKLIST_PATTERNS = [
  /\b(?:my|saved)\s+(?:tps\s+|ead\s+|travel(?:\s+authorization)?\s+)?(?:checklist|progress)\b/,
  /\b(?:tps|ead|travel(?:\s+authorization)?)\s+(?:checklist|progress)\b/,
  /\b(?:checklist|progress)\s+(?:summary|status)\b/,
  /\bwhat\s+(?:is|s)\s+(?:left|remaining)\s+(?:on|in)\s+(?:my\s+)?(?:tps\s+|ead\s+|travel\s+)?checklist\b/
];

const BASE_CHECKLIST_NOUNS = [
  "checklist", "lista de control", "lista de verificación", "kontrol listesi",
  "liste de contrôle", "清单", "चेकलिस्ट", "जांच सूची", "قائمة التحقق",
  "চেকলিস্ট", "контрольный список", "чеклист", "lista de verificação",
  "lista di controllo", "liście kontrolnej", "liscie kontrolnej"
];

const BASE_PROGRESS_QUERIES = [
  "show my", "what is left", "what remains", "progress", "status", "summary",
  "qué falta", "que falta", "progreso", "estado", "ne kaldı", "ilerleme", "durum",
  "que reste", "progrès", "statut", "还剩", "进度", "स्थिति", "क्या बाकी",
  "ما المتبقي", "تقدم", "আমার কী বাকি", "অগ্রগতি", "что осталось", "прогресс",
  "o que falta", "progresso", "cosa manca", "a che punto", "stato"
];

const EU_CHECKLIST_NOUNS = [
  "kontrolní seznam", "kontrolna lista", "контролен списък", "tjekliste",
  "checklist", "kontrollnimekiri", "Checkliste", "tarkistuslista", "λίστα ελέγχου",
  "ellenőrzőlista", "seicliosta", "kontrolsaraksts", "kontrolinis sąrašas",
  "lista ta’ kontroll", "lista kontrolna", "listă de verificare", "kontrolni seznam",
  "kontrolný zoznam", "checklista"
];
const EU_PROGRESS_QUERIES = [
  "shrnutí postupu", "co zbývá", "kolik je hotovo",
  "sažmi napredak", "što je preostalo", "koliko je gotovo", "prikaži stanje",
  "какво остава", "какво е завършено", "напредък по списъка", "какво следва", "общ напредък",
  "hvad mangler", "fremskridt tilbage", "status på tjekliste", "hvad er næste",
  "voortgang", "overgebleven stappen", "wat blijft over", "status samenvatting", "checklist samenvatten",
  "kokkuvõte", "edenemine", "mis on tehtud", "mis on jäänud",
  "Fortschritt", "Stand", "Übersicht", "was bleibt",
  "edistyminen", "tarkistuslistan tila", "mitä on jäljellä", "mitä on tehty",
  "πρόοδος λίστας", "τι απομένει", "τι έχει μείνει", "επόμενο βήμα", "σύνοψη προόδου",
  "összegzés", "haladás", "mi van hátra", "mi a következő",
  "cad atá fágtha", "cé mhéad atá déanta", "cad atá fágtha fós",
  "kāds progress", "kas atlikis", "kas jau pabeigts", "kā iet", "man progress",
  "kas liko", "pažangos santrauka", "kas atlikta",
  "sommarju", "progress tal-lista", "x’fadal",
  "podsumowanie", "postęp", "co zostało",
  "rezumat", "progres", "ce a rămas",
  "kaj je ostalo", "napredek", "kako napredujem", "kaj še manjka",
  "stav kontrolného zoznamu", "čo zostáva", "pokrok úlohy", "čo je hotové",
  "sammanfatta min checklista", "hur långt har jag kommit", "vad återstår",
  "visa framdrift", "status för checklistan", "min utveckling"
];

const normalizedTerms = (terms) => [...new Set(terms.map(normalizeIntentText).filter(Boolean))];
const CHECKLIST_NOUNS = normalizedTerms([...BASE_CHECKLIST_NOUNS, ...EU_CHECKLIST_NOUNS]);
const PROGRESS_QUERIES = normalizedTerms([...BASE_PROGRESS_QUERIES, ...EU_PROGRESS_QUERIES]);

const includesLocalizedTerm = (normalized, terms) => terms.some((term) =>
  normalized === term || normalized.includes(term)
);

export function isExplicitSavedChecklistSummary(question, localizedPrompts = []) {
  const normalized = normalizeIntentText(question);
  if (!normalized) return false;

  const matchesLocalizedPrompt = localizedPrompts
    .map(normalizeIntentText)
    .filter(Boolean)
    .some((prompt) => normalized === prompt);

  const matchesExplicitPattern = EXPLICIT_SAVED_CHECKLIST_PATTERNS.some(
    (pattern) => pattern.test(normalized)
  );
  const matchesNaturalLocalizedRequest =
    includesLocalizedTerm(normalized, CHECKLIST_NOUNS) &&
    includesLocalizedTerm(normalized, PROGRESS_QUERIES);

  return matchesLocalizedPrompt || matchesExplicitPattern || matchesNaturalLocalizedRequest;
}

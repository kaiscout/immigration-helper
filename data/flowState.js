import AsyncStorage from "@react-native-async-storage/async-storage";

import eadFlow from "./flows/ead.json";
import tpsFlow from "./flows/tps_renewal.json";
import travelFlow from "./flows/travel_auth.json";

export const FLOWS = [
  {
    key: "tps",
    aliases: [
      "tps", "tpa", "temporary protected status", "renewal", "tps renewal",
      "temporary protection", "protected status", "re registration", "reregistration",
      "estatus de proteccion temporal", "estatus de protección temporal", "renovacion tps", "renovación tps",
      "gecici koruma statusu", "geçici koruma statüsü", "tps yenileme",
      "statut de protection temporaire", "renouvellement tps",
      "status de protecao temporaria", "status de proteção temporária",
      "renovacao do tps", "renovação do tps", "novo registro do tps",
      "status di protezione temporanea", "rinnovo tps", "rinnovo del tps",
      "临时保护身份", "tps 续期", "tps续期",
      "अस्थायी संरक्षित स्थिति", "टीपीएस", "tps नवीनीकरण",
      "الحماية المؤقتة", "تجديد tps",
      "অস্থায়ী সুরক্ষিত অবস্থা", "টিপিএস", "tps নবায়ন",
      "временный защищенный статус", "продление tps"
    ],
    data: tpsFlow
  },
  {
    key: "ead",
    aliases: [
      "ead", "work permit", "work authorization", "i-765", "employment authorization",
      "employment authorization document", "work card", "employment card", "permission to work",
      "authorization to work", "i 765", "form i 765",
      "permiso de trabajo", "autorizacion de empleo", "autorización de empleo",
      "calisma izni", "çalışma izni",
      "permis de travail", "autorisation de travail",
      "autorizacao de trabalho", "autorização de trabalho", "permissao de trabalho",
      "permissão de trabalho", "documento de autorizacao de emprego",
      "documento de autorização de emprego", "formulario i-765", "formulário i-765",
      "permesso di lavoro", "autorizzazione al lavoro", "documento di autorizzazione al lavoro",
      "modulo i-765",
      "工作许可", "工作授权",
      "वर्क परमिट", "कार्य अनुमति",
      "تصريح العمل", "إذن العمل",
      "ওয়ার্ক পারমিট", "কাজের অনুমতি",
      "разрешение на работу"
    ],
    data: eadFlow
  },
  {
    key: "travel",
    aliases: [
      "travel", "travel authorization", "advance parole", "i-131", "travel permit",
      "travel document", "permission to travel", "advance travel", "i 131", "form i 131",
      "parole document", "reentry", "re entry",
      "autorizacion de viaje", "autorización de viaje", "permiso de viaje",
      "seyahat izni", "seyahat yetkisi",
      "autorisation de voyage", "permis de voyage",
      "autorizacao de viagem", "autorização de viagem", "documento de viagem",
      "permissao para viajar", "permissão para viajar", "formulario i-131", "formulário i-131",
      "autorizzazione al viaggio", "permesso di viaggio", "documento di viaggio", "modulo i-131",
      "旅行授权", "旅行许可", "回美纸",
      "यात्रा अनुमति", "यात्रा परमिट",
      "تصريح السفر", "إذن السفر", "وثيقة سفر",
      "ভ্রমণ অনুমতি", "ভ্রমণ পারমিট",
      "разрешение на поездку", "разрешение на путешествие"
    ],
    data: travelFlow
  }
];

export const formatYMD = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

export const storageKeyForFlow = (flow) => `flow_${flow?.id}_state`;

export const defaultFlowState = {
  noticeDate: "",
  dueDate: "",
  done: {}
};

export const pickLocalized = (obj, base, lang = "en") => {
  if (!obj) return "";
  const code = (lang || "en").toLowerCase().split("-")[0];
  return obj?.[`${base}_${code}`] ?? obj?.[`${base}_en`] ?? obj?.[base] ?? "";
};

export const computeDueDate = (flow, noticeDate) => {
  if (!noticeDate) return "";
  const base = new Date(noticeDate);
  if (isNaN(base.getTime())) return "";

  const offset = Number(flow?.deadlineLogic?.offsetDays ?? 0);
  if (!offset) return "";

  return formatYMD(new Date(base.getTime() + offset * 24 * 60 * 60 * 1000));
};

export const computeKeyDates = (flow, noticeDate, lang = "en") => {
  if (!noticeDate) return [];
  const base = new Date(noticeDate);
  if (isNaN(base.getTime())) return [];

  if (Array.isArray(flow?.calculators) && flow.calculators.length > 0) {
    return flow.calculators.map((calc) => {
      const days = Number(calc.offsetDays || 0);
      return {
        id: calc.id || `calc_${days}`,
        label: pickLocalized(calc, "label", lang),
        iso: formatYMD(new Date(base.getTime() + days * 24 * 60 * 60 * 1000))
      };
    });
  }

  const dueDate = computeDueDate(flow, noticeDate);
  return dueDate ? [{ id: "computed_due", label: "Suggested mailing date", iso: dueDate }] : [];
};

export const loadFlowState = async (flow) => {
  try {
    const raw = await AsyncStorage.getItem(storageKeyForFlow(flow));
    if (!raw) return { ...defaultFlowState };
    const parsed = JSON.parse(raw);
    return {
      noticeDate: parsed.noticeDate || "",
      dueDate: parsed.dueDate || "",
      done: parsed.done || {}
    };
  } catch {
    return { ...defaultFlowState };
  }
};

export const saveFlowState = async (flow, state) => {
  const next = {
    noticeDate: state.noticeDate || "",
    dueDate: state.dueDate || "",
    done: state.done || {}
  };
  await AsyncStorage.setItem(storageKeyForFlow(flow), JSON.stringify(next));
  return next;
};

export const loadAllFlowStates = async () => {
  const entries = await Promise.all(
    FLOWS.map(async (item) => [item.key, await loadFlowState(item.data)])
  );
  return Object.fromEntries(entries);
};

export const findFlowByText = (text) => {
  const q = normalizeText(text);
  let best = null;
  let bestScore = 0;

  FLOWS.forEach((item) => {
    const score = scoreTextMatch(q, [
      item.key,
      item.data?.id,
      ...item.aliases,
      ...(item.data?.forms || []).flatMap((form) => localizedValues(form, "title"))
    ]);

    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  });

  return bestScore >= 4 ? best : null;
};

export const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const textTokens = (value) =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);

export const localizedValues = (obj, base) => {
  if (!obj) return [];
  return Object.entries(obj)
    .filter(([key, value]) => (key === base || key.startsWith(`${base}_`)) && typeof value === "string")
    .map(([, value]) => value);
};

export const scoreTextMatch = (query, candidates) => {
  const q = normalizeText(query);
  if (!q) return 0;

  const queryTokens = textTokens(q);
  let best = 0;

  candidates.filter(Boolean).forEach((candidate) => {
    const c = normalizeText(candidate);
    if (!c) return;

    if (q === c) {
      best = Math.max(best, 12);
      return;
    }

    if (q.includes(c) || c.includes(q)) {
      best = Math.max(best, Math.min(10, 4 + textTokens(c).length));
    }

    const candidateTokens = textTokens(c);
    if (!candidateTokens.length || !queryTokens.length) return;

    const matched = candidateTokens.filter((candidateToken) =>
      queryTokens.some((queryToken) =>
        queryToken === candidateToken ||
        queryToken.startsWith(candidateToken) ||
        candidateToken.startsWith(queryToken) ||
        (candidateToken.length > 4 && queryToken.length > 4 && (
          candidateToken.includes(queryToken) || queryToken.includes(candidateToken)
        ))
      )
    );

    if (matched.length) {
      const coverage = matched.length / candidateTokens.length;
      const density = matched.length / Math.max(queryTokens.length, 1);
      best = Math.max(best, matched.length + coverage * 2 + density);
    }
  });

  return best;
};

export const findStepByText = (flow, text, lang = "en") => {
  const q = normalizeText(text);
  const steps = Array.isArray(flow?.steps) ? flow.steps : [];
  const stopWords = new Set([
    "a", "an", "and", "are", "for", "i", "is", "it", "me", "my", "of", "on", "or",
    "please", "step", "the", "this", "to", "with", "mark", "check", "complete",
    "finish", "done", "undo", "uncheck", "remove", "not", "all", "tps", "tpa",
    "ead", "work", "permit", "travel", "authorization",
    "um", "uma", "os", "as", "e", "ou", "de", "do", "da", "dos", "das", "para",
    "por", "meu", "minha", "marcar", "marque", "concluir", "concluido",
    "desmarcar", "remover", "pendente", "todos", "todas", "trabalho", "viagem",
    "autorizacao",
    "un", "una", "il", "lo", "la", "i", "gli", "le", "e", "o", "di", "del",
    "della", "dei", "delle", "per", "mio", "mia", "segna", "segnare", "completa",
    "completato", "deseleziona", "rimuovi", "mancante", "tutti", "lavoro", "viaggio"
  ]);
  const queryTokens = q.split(" ").filter((token) => token.length > 2 && !stopWords.has(token));

  let best = null;
  let bestScore = 0;

  steps.forEach((step) => {
    const parts = [
      step.id,
      pickLocalized(step, "title", lang),
      pickLocalized(step, "details", lang),
      pickLocalized(step, "title", "en"),
      pickLocalized(step, "details", "en"),
      ...localizedValues(step, "title"),
      ...localizedValues(step, "details")
    ].map(normalizeText);

    if (parts.some((part) => part && (q.includes(part) || part.includes(q)))) {
      best = step;
      bestScore = Math.max(bestScore, 999);
      return;
    }

    const stepText = parts.join(" ");
    const semanticScore = scoreTextMatch(q, parts);
    const score = queryTokens.filter((token) => stepText.includes(token)).length;
    const combinedScore = Math.max(score, semanticScore);
    if (combinedScore > bestScore) {
      best = step;
      bestScore = combinedScore;
    }
  });

  return bestScore >= 1 ? best : null;
};

export const getFlowProgress = (flow, state) => {
  const steps = Array.isArray(flow?.steps) ? flow.steps : [];
  const completed = steps.filter((step) => state?.done?.[step.id]);
  const remaining = steps.filter((step) => !state?.done?.[step.id]);
  const percent = steps.length ? Math.round((completed.length / steps.length) * 100) : 0;

  return {
    total: steps.length,
    completed,
    remaining,
    percent
  };
};

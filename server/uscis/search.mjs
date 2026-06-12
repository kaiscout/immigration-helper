import fs from "node:fs";
import zlib from "node:zlib";
import { CORPUS_PATH, PACKAGED_CORPUS_PATH } from "./paths.mjs";

export { PACKAGED_CORPUS_PATH };

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "can", "could", "did", "does", "for",
  "from", "have", "how", "immigration", "into", "not", "that", "the", "their",
  "this", "uscis", "was", "what", "when", "where", "which", "who", "will", "with",
  "would", "you", "your"
]);

const TOPIC_ALIASES = [
  {
    match: ["green card", "permanent resident", "residencia", "tarjeta verde", "cartão verde", "residente permanente", "carta verde", "residente permanente", "yeşil kart", "carte verte", "绿卡", "ग्रीन कार्ड", "البطاقة الخضراء", "গ্রিন কার্ড", "грин карта"],
    add: ["green", "card", "permanent", "resident", "adjustment", "status"]
  },
  {
    match: ["citizenship", "naturalization", "ciudadania", "ciudadanía", "cidadania", "naturalização", "cittadinanza", "naturalizzazione", "vatandaslik", "vatandaşlık", "citoyennete", "citoyenneté", "公民", "入籍", "नागरिकता", "الجنسية", "নাগরিকত্ব", "гражданство"],
    add: ["citizenship", "naturalization", "n-400"]
  },
  {
    match: ["work permit", "employment authorization", "permiso de trabajo", "autorização de trabalho", "permissão de trabalho", "permesso di lavoro", "autorizzazione al lavoro", "calisma izni", "çalışma izni", "permis de travail", "工作许可", "वर्क परमिट", "تصريح العمل", "কাজের অনুমতি", "разрешение на работу"],
    add: ["work", "permit", "employment", "authorization", "ead", "i-765"],
    prefer: ["/employment-authorization"]
  },
  {
    match: ["travel document", "advance parole", "travel authorization", "permiso de viaje", "autorização de viagem", "documento de viagem", "permissão para viajar", "autorizzazione al viaggio", "documento di viaggio", "permesso di viaggio", "seyahat izni", "document de voyage", "旅行许可", "यात्रा अनुमति", "وثيقة سفر", "ভ্রমণ অনুমতি", "проездной документ"],
    add: ["travel", "document", "advance", "parole", "i-131"]
  },
  {
    match: ["asylum", "refugee", "asilo", "refugiado", "rifugiato", "iltica", "mülteci", "asile", "refugie", "réfugié", "庇护", "难民", "शरण", "لاجئ", "اللجوء", "আশ্রয়", "беженец", "убежище"],
    add: ["asylum", "refugee", "humanitarian", "i-589"]
  },
  {
    match: ["tps", "temporary protected status", "estatus de proteccion temporal", "status de proteção temporária", "renovação do tps", "status di protezione temporanea", "rinnovo tps", "gecici koruma", "statut de protection temporaire", "临时保护身份", "अस्थायी संरक्षित", "الحماية المؤقتة", "অস্থায়ী সুরক্ষিত", "временный защищенный"],
    add: ["tps", "temporary", "protected", "status", "re-registration"]
  },
  {
    match: ["family petition", "petition relative", "peticion familiar", "petição familiar", "parente", "petizione familiare", "familiare", "aile dilekce", "regroupement familial", "家庭移民", "परिवार याचिका", "التماس عائلي", "পারিবারিক আবেদন", "семейная петиция"],
    add: ["family", "petition", "relative", "i-130"]
  },
  {
    match: ["fee", "cost", "tarifa", "costo", "taxa", "custo", "pagamento", "tariffa", "costo", "pagamento", "ucret", "ücret", "frais", "费用", "फीस", "رسوم", "ফি", "сбор"],
    add: ["fee", "filing", "payment", "g-1055"],
    prefer: ["/forms/filing-fees", "/g-1055"]
  },
  {
    match: ["processing time", "how long", "tiempo de procesamiento", "tempo de processamento", "quanto tempo", "atraso", "tempo di elaborazione", "quanto tempo", "ritardo", "ne kadar surer", "délai de traitement", "处理时间", "प्रोसेसिंग समय", "وقت المعالجة", "প্রসেসিং সময়", "срок обработки"],
    add: ["processing", "time", "delay", "case"]
  },
  {
    match: [
      "change address", "changed my address", "moved",
      "cambio de direccion", "cambiar direccion", "cambié de dirección", "direccion",
      "mudar endereço", "alteração de endereço", "endereço",
      "cambiare indirizzo", "cambio di indirizzo", "mi sono trasferito", "indirizzo",
      "adres degisikligi", "adres değiştirme", "taşındım", "adres",
      "changement adresse", "changer adresse", "j ai demenage", "adresse",
      "更改地址", "修改地址", "搬家", "地址",
      "पता बदल", "पता परिवर्तन", "पता",
      "تغيير العنوان", "غيرت عنواني", "عنوان",
      "ঠিকানা পরিবর্তন", "ঠিকানা বদল", "ঠিকানা",
      "смена адреса", "изменить адрес", "поменять адрес", "переехал", "адрес"
    ],
    add: ["change", "address", "ar-11", "moving"],
    prefer: ["/addresschange"]
  },
  {
    match: ["request for evidence", "rfe", "solicitud de evidencia", "pedido de provas", "solicitação de provas", "richiesta di prove", "richiesta di documenti", "kanit talebi", "demande de preuves", "补件", "सबूत का अनुरोध", "طلب أدلة", "প্রমাণের অনুরোধ", "запрос доказательств"],
    add: ["request", "evidence", "rfe", "response", "deadline"],
    prefer: ["/policy-manual/volume-1-part-e-chapter-6"]
  },
  {
    match: ["biometrics", "fingerprint", "biometria", "impressões digitais", "dati biometrici", "impronte digitali", "parmak izi", "biometrie", "生物识别", "बायोमेट्रिक", "بصمات", "বায়োমেট্রিক", "биометрия"],
    add: ["biometrics", "fingerprint", "appointment", "asc"],
    prefer: ["/preparing-for-your-biometric-services-appointment"]
  },
  {
    match: ["case status", "receipt number", "estado del caso", "status do caso", "número do recibo", "stato del caso", "numero di ricevuta", "dosya durumu", "statut du dossier", "案件状态", "केस स्थिति", "حالة القضية", "কেস স্ট্যাটাস", "статус дела"],
    add: ["case", "status", "receipt", "number", "online"],
    prefer: ["/tools/checking-your-case-status-online"]
  },
  {
    match: ["scam", "fraud", "estafa", "fraude", "golpe", "truffa", "frode", "dolandirici", "arnaque", "诈骗", "धोखाधड़ी", "احتيال", "প্রতারণা", "мошенничество"],
    add: ["scam", "fraud", "avoid", "legal", "services"],
    prefer: ["/avoid-scams"]
  }
];

const TRANSLATED_PAGE_SUFFIX =
  /-(?:arabic|bengali|chinese|french|hindi|italian|portuguese|russian|spanish|tagalog|turkish)(?:$|\/)/;

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(token) {
  if (!/^[a-z]+$/.test(token) || token.length < 5) return token;
  return token
    .replace(/(ization|ational|fulness|ousness|iveness)$/, "")
    .replace(/(ments|ment|ingly|edly|ation|ities|ity|ing|ers|ies|ed|es|s)$/, "");
}

function tokens(value) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .map(stem);
}

function analyzeQuery(query) {
  const normalized = normalize(query);
  const expanded = tokens(normalized);
  const preferredPaths = [];
  for (const topic of TOPIC_ALIASES) {
    if (topic.match.some((phrase) => normalized.includes(normalize(phrase)))) {
      expanded.push(...topic.add.map(stem));
      preferredPaths.push(...(topic.prefer || []));
    }
  }
  return {
    tokens: [...new Set(expanded)],
    preferredPaths: [...new Set(preferredPaths)]
  };
}

function readCorpusText(filePath) {
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, "utf8");
  if (fs.existsSync(PACKAGED_CORPUS_PATH)) {
    return zlib.gunzipSync(fs.readFileSync(PACKAGED_CORPUS_PATH)).toString("utf8");
  }
  return "";
}

export function loadCorpus(filePath = CORPUS_PATH) {
  return readCorpusText(filePath)
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function splitOversizedChunk(value, maxLength = 2_000, overlap = 240) {
  if (value.length <= maxLength) return [value];
  const parts = [];
  let start = 0;

  while (start < value.length) {
    let end = Math.min(start + maxLength, value.length);
    if (end < value.length) {
      const boundary = Math.max(
        value.lastIndexOf(". ", end),
        value.lastIndexOf("\n", end),
        value.lastIndexOf(" ", end)
      );
      if (boundary > start + Math.floor(maxLength * 0.65)) end = boundary + 1;
    }
    parts.push(value.slice(start, end).trim());
    if (end >= value.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return parts.filter(Boolean);
}

export function createCorpusIndex(records) {
  const documents = [];
  const documentFrequency = new Map();
  let totalLength = 0;

  records.forEach((record) => {
    if (/^(?:page not found|access denied)$/i.test(record.title || "")) return;
    const rawChunks = record.chunks?.length ? record.chunks : [record.text || ""];
    rawChunks.flatMap((chunk) => splitOversizedChunk(chunk)).forEach((text, chunkIndex) => {
      if (!text.trim()) return;
      const bodyTokens = tokens(text);
      const titleTokens = tokens(`${record.title || ""} ${record.description || ""}`);
      const frequencies = new Map();
      bodyTokens.forEach((token) => frequencies.set(token, (frequencies.get(token) || 0) + 1));
      const unique = new Set([...bodyTokens, ...titleTokens]);
      unique.forEach((token) => {
        documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
      });
      totalLength += bodyTokens.length;
      documents.push({
        url: record.url,
        title: record.title,
        description: record.description,
        lastModified: record.lastModified,
        text,
        normalizedText: normalize(text),
        normalizedTitle: normalize(record.title),
        titleTokens: new Set(titleTokens),
        frequencies,
        length: bodyTokens.length,
        chunkIndex
      });
    });
  });

  return {
    documents,
    documentFrequency,
    averageLength: documents.length ? totalLength / documents.length : 1,
    pageCount: records.length
  };
}

export function searchCorpus(indexOrRecords, query, limit = 6) {
  const index = Array.isArray(indexOrRecords) ? createCorpusIndex(indexOrRecords) : indexOrRecords;
  const analysis = analyzeQuery(query);
  const queryTokens = analysis.tokens;
  if (!queryTokens.length || !index.documents.length) return [];

  const normalizedQuery = normalize(query);
  const scored = [];
  const k1 = 1.35;
  const b = 0.72;

  for (const document of index.documents) {
    let score = 0;
    let matchedTerms = 0;

    for (const token of queryTokens) {
      const frequency = document.frequencies.get(token) || 0;
      const titleMatch = document.titleTokens.has(token);
      if (!frequency && !titleMatch) continue;

      matchedTerms += 1;
      const containingDocuments = index.documentFrequency.get(token) || 0;
      const idf = Math.log(1 + (index.documents.length - containingDocuments + 0.5) / (containingDocuments + 0.5));
      const denominator = frequency + k1 * (1 - b + b * document.length / index.averageLength);
      if (frequency) score += idf * ((frequency * (k1 + 1)) / denominator);
      if (titleMatch) score += idf * 5;
    }

    if (!matchedTerms) continue;
    score *= 0.65 + 0.35 * (matchedTerms / queryTokens.length);
    if (normalizedQuery.length > 8 && document.normalizedText.includes(normalizedQuery)) score += 8;
    if (normalizedQuery.length > 8 && document.normalizedTitle.includes(normalizedQuery)) score += 12;
    if (analysis.preferredPaths.some((preferredPath) => document.url.includes(preferredPath))) score += 40;
    if (document.url.includes("/policy-manual/")) score += 4;
    if (document.url.includes("/forms/")) score += 2;
    if (document.url.includes("/newsroom/")) score -= 3;
    if (TRANSLATED_PAGE_SUFFIX.test(document.url)) score -= 25;
    scored.push({ document, score });
  }

  const pageCounts = new Map();
  return scored
    .sort((a, b) => b.score - a.score)
    .filter(({ document }) => {
      const count = pageCounts.get(document.url) || 0;
      if (count >= 2) return false;
      pageCounts.set(document.url, count + 1);
      return true;
    })
    .slice(0, limit)
    .map(({ document, score }) => ({
      url: document.url,
      title: document.title,
      lastModified: document.lastModified,
      excerpt: document.text.slice(0, 2_000),
      chunkIndex: document.chunkIndex,
      score: Number(score.toFixed(4))
    }));
}

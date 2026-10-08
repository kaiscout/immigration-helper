export const CASEPILOT_REPORT_CATEGORIES = Object.freeze([
  "inaccurate",
  "unsafe",
  "irrelevant",
  "offensive",
  "other"
]);

export const CASEPILOT_REPORT_RESPONSE_LIMIT = 1200;
export const CASEPILOT_REPORT_NOTE_LIMIT = 300;

const singleLine = (value, maximum) => String(value || "")
  .replace(/[\r\n\t]+/gu, " ")
  .replace(/\s{2,}/gu, " ")
  .trim()
  .slice(0, maximum);

const clippedBlock = (value, maximum) => {
  const normalized = String(value || "")
    .replace(/\r\n?/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
};

export function createCasePilotReportId(randomUUID = globalThis.crypto?.randomUUID) {
  if (typeof randomUUID === "function") {
    return `cpr_${randomUUID.call(globalThis.crypto)}`;
  }
  return `cpr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function prepareCasePilotReport({
  reportId,
  category,
  categoryLabel,
  responseText,
  note,
  language,
  appVersion,
  backendVersion
}) {
  if (!CASEPILOT_REPORT_CATEGORIES.includes(category)) {
    throw new TypeError("A supported CasePilot report category is required.");
  }

  const excerpt = clippedBlock(responseText, CASEPILOT_REPORT_RESPONSE_LIMIT);
  if (!excerpt) throw new TypeError("A CasePilot response is required.");

  const normalizedId = singleLine(reportId, 96) || createCasePilotReportId();
  const normalizedNote = clippedBlock(note, CASEPILOT_REPORT_NOTE_LIMIT);
  const metadata = Object.freeze({
    reportId: normalizedId,
    category,
    categoryLabel: singleLine(categoryLabel, 80) || category,
    language: singleLine(language, 24) || "unknown",
    appVersion: singleLine(appVersion, 32) || "unknown",
    backendVersion: singleLine(backendVersion, 48) || "unknown"
  });

  return Object.freeze({
    ...metadata,
    responseExcerpt: excerpt,
    note: normalizedNote
  });
}

export function casePilotReportEmail({ report, labels }) {
  const subject = `[CasePilot report] ${report.category} · ${report.reportId}`;
  const lines = [
    labels.heading,
    "",
    `${labels.reportId}: ${report.reportId}`,
    `${labels.category}: ${report.categoryLabel} (${report.category})`,
    `${labels.language}: ${report.language}`,
    `${labels.appVersion}: ${report.appVersion}`,
    `${labels.backendVersion}: ${report.backendVersion}`,
    "",
    labels.response,
    report.responseExcerpt
  ];

  if (report.note) {
    lines.push("", labels.note, report.note);
  }

  lines.push("", labels.privacyFooter);
  return Object.freeze({ subject, body: lines.join("\n") });
}

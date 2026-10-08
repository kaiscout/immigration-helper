import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CASEPILOT_REPORT_NOTE_LIMIT,
  CASEPILOT_REPORT_RESPONSE_LIMIT,
  casePilotReportEmail,
  prepareCasePilotReport
} from "../data/casePilotReportCore.mjs";

const labels = {
  heading: "CasePilot response report",
  reportId: "Report ID",
  category: "Category",
  language: "App language",
  appVersion: "App version",
  backendVersion: "CasePilot service version",
  response: "Selected CasePilot response excerpt:",
  note: "Optional user note:",
  privacyFooter: "Only the selected response was attached."
};

test("CasePilot report contains only the reviewed response, note, and operational metadata", () => {
  const report = prepareCasePilotReport({
    reportId: "cpr_test",
    category: "inaccurate",
    categoryLabel: "Inaccurate",
    responseText: "The selected assistant response.",
    note: "The source link is outdated.",
    language: "en",
    appVersion: "1.0.0",
    backendVersion: "2026-10-08.1"
  });
  const email = casePilotReportEmail({ report, labels });

  assert.match(email.body, /The selected assistant response\./);
  assert.match(email.body, /The source link is outdated\./);
  assert.match(email.body, /2026-10-08\.1/);
  for (const privateField of ["prompt", "conversationHistory", "caseProfile", "checklist", "fileVault"]) {
    assert.equal(Object.hasOwn(report, privateField), false);
  }
});

test("CasePilot reports reject unsupported categories and empty answers", () => {
  const base = {
    reportId: "cpr_test",
    categoryLabel: "Other",
    responseText: "Answer",
    language: "en"
  };
  assert.throws(() => prepareCasePilotReport({ ...base, category: "invented" }), /supported/);
  assert.throws(
    () => prepareCasePilotReport({ ...base, category: "other", responseText: "   " }),
    /response is required/
  );
});

test("CasePilot reports enforce short response and note limits", () => {
  const report = prepareCasePilotReport({
    reportId: "cpr_test",
    category: "other",
    categoryLabel: "Other",
    responseText: "A".repeat(CASEPILOT_REPORT_RESPONSE_LIMIT + 100),
    note: "B".repeat(CASEPILOT_REPORT_NOTE_LIMIT + 100),
    language: "en"
  });
  assert.equal(report.responseExcerpt.length, CASEPILOT_REPORT_RESPONSE_LIMIT);
  assert.equal(report.note.length, CASEPILOT_REPORT_NOTE_LIMIT);
  assert.match(report.responseExcerpt, /…$/u);
  assert.match(report.note, /…$/u);
});

test("report UI requires review, uses the device mail composer, and reports delivery honestly", async () => {
  const [screen, modal, delivery] = await Promise.all([
    readFile(new URL("../screens/AIAdvisorScreen.js", import.meta.url), "utf8"),
    readFile(new URL("../components/CasePilotReportModal.js", import.meta.url), "utf8"),
    readFile(new URL("../data/casePilotReport.js", import.meta.url), "utf8")
  ]);

  assert.match(screen, /msg\.reportable && !msg\.streaming/);
  assert.match(screen, /casePilotReport\.action/);
  assert.match(modal, /casePilotReport\.previewLabel/);
  assert.match(modal, /containsSensitiveIdentifier/);
  assert.match(delivery, /MailComposer\.composeAsync/);
  assert.match(delivery, /Linking\.openURL/);
  assert.match(modal, /resultSent/);
  assert.match(modal, /resultSaved/);
  assert.match(modal, /resultCancelled/);
  assert.match(modal, /resultUnknown/);
});

test("successful API answers include the deployed service version for report triage", async () => {
  const source = await readFile(new URL("../server/index.mjs", import.meta.url), "utf8");
  assert.match(source, /server_version:\s*SERVER_VERSION/);
});

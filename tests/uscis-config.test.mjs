import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isRelevantUscisUrl,
  normalizeUscisUrl,
  parseRobotsRules
} from "../server/uscis/config.mjs";
import { extractUscisPage } from "../server/uscis/corpus.mjs";
import { createCorpusIndex, searchCorpus } from "../server/uscis/search.mjs";

test("uses the current USCIS Avoid Scams hub everywhere", () => {
  const files = [
    "../constants/officialLinks.js",
    "../data/resources.js",
    "../screens/HomeScreen.js",
    "../screens/AIAdvisorScreen.js",
    "../data/flows/tps_renewal.json"
  ];
  const source = files
    .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
    .join("\n");

  assert.equal(
    source.match(/https:\/\/www\.uscis\.gov\/avoid-scams/g)?.length,
    2,
    "The shared link constant and TPS flow should use the current Avoid Scams hub."
  );
  assert.doesNotMatch(
    source,
    /https:\/\/www\.uscis\.gov\/scams-fraud-and-misconduct\/avoid-scams["']/
  );
  assert.match(source, /OFFICIAL_LINKS\.scams/);
});

test("normalizes only official USCIS URLs", () => {
  assert.equal(
    normalizeUscisUrl("https://www.uscis.gov/green-card/?utm_source=test#section"),
    "https://www.uscis.gov/green-card"
  );
  assert.equal(normalizeUscisUrl("https://example.com/green-card"), null);
});

test("includes current immigration guidance and excludes archives and files", () => {
  assert.equal(isRelevantUscisUrl("https://www.uscis.gov/green-card/green-card-processes-and-procedures"), true);
  assert.equal(isRelevantUscisUrl("https://www.uscis.gov/humanitarian/refugees-and-asylum"), true);
  assert.equal(isRelevantUscisUrl("https://www.uscis.gov/"), false);
  assert.equal(isRelevantUscisUrl("https://www.uscis.gov/archive/old-guidance"), false);
  assert.equal(isRelevantUscisUrl("https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf"), false);
  assert.equal(isRelevantUscisUrl("https://www.uscis.gov/forms/myaccount-redirect"), false);
});

test("honors parsed robots disallow paths", () => {
  const rules = parseRobotsRules("User-agent: *\nDisallow: /tools/private\n");
  assert.deepEqual(rules, ["/tools/private"]);
  assert.equal(isRelevantUscisUrl("https://www.uscis.gov/tools/private/page", rules), false);
});

test("extracts readable page text and chunks", () => {
  const page = extractUscisPage(
    "<html><head><title>Test</title></head><body><main><h1>Entering the United States</h1><p>" +
    "This is official test guidance with enough meaningful text to verify extraction. ".repeat(4) +
    "</p></main></body></html>",
    "https://www.uscis.gov/visit-the-united-states"
  );
  assert.equal(page.title, "Entering the United States");
  assert.ok(page.text.includes("official test guidance"));
  assert.ok(page.chunks.length >= 1);
});

test("retrieves the matching passage instead of always returning the first chunk", () => {
  const index = createCorpusIndex([{
    url: "https://www.uscis.gov/forms/filing-fees",
    title: "Filing Fees",
    description: "Official fee guidance",
    chunks: [
      "This opening passage describes how to find a form.",
      "You may pay certain USCIS filing fees online. Check the current fee schedule before filing."
    ]
  }]);

  const [result] = searchCorpus(index, "How do I pay a filing fee?");
  assert.ok(result.excerpt.includes("pay certain USCIS filing fees"));
  assert.equal(result.chunkIndex, 1);
});

test("expands supported-language immigration terms for English USCIS retrieval", () => {
  const index = createCorpusIndex([{
    url: "https://www.uscis.gov/working-in-the-united-states",
    title: "Employment Authorization",
    description: "",
    chunks: ["Use Form I-765 to request employment authorization in eligible categories."]
  }]);

  for (const question of [
    "¿Cómo solicito un permiso de trabajo?",
    "Como solicito uma autorização de trabalho?",
    "Come posso richiedere un permesso di lavoro?"
  ]) {
    assert.equal(searchCorpus(index, question, 1)[0]?.title, "Employment Authorization");
  }
});

test("recognizes natural address-change phrasing across supported languages", () => {
  const index = createCorpusIndex([{
    url: "https://www.uscis.gov/addresschange",
    title: "How to Change Your Address",
    description: "",
    chunks: ["Most people can report a change of address through a USCIS online account."]
  }]);

  for (const question of [
    "मैं अपना पता कैसे बदलूं?",
    "Comment changer mon adresse auprès de USCIS?",
    "كيف أغير عنواني؟",
    "Как изменить адрес в USCIS?",
    "Como posso mudar meu endereço no USCIS?",
    "Come posso cambiare il mio indirizzo con USCIS?"
  ]) {
    assert.equal(searchCorpus(index, question, 1)[0]?.title, "How to Change Your Address");
  }
});

test("prefers canonical USCIS guidance over translated duplicate pages", () => {
  const index = createCorpusIndex([{
    url: "https://www.uscis.gov/forms/filing-guidance/preparing-for-your-biometric-services-appointment",
    title: "Preparing for Your Biometric Services Appointment",
    description: "",
    chunks: ["Reschedule a biometrics appointment through your USCIS online account before the appointment time."]
  }, {
    url: "https://www.uscis.gov/forms/filing-guidance/preparing-for-your-biometric-services-appointment/preparing-for-your-biometric-services-appointment-french",
    title: "Confirmation de rendez-vous biométrique",
    description: "",
    chunks: ["Biometria appointment account reschedule USCIS."]
  }]);

  const [result] = searchCorpus(index, "Perdi meu agendamento de biometria");
  assert.equal(result.title, "Preparing for Your Biometric Services Appointment");
});

test("excludes non-content error pages from the searchable index", () => {
  const index = createCorpusIndex([{
    url: "https://www.uscis.gov/page-not-found",
    title: "Page Not Found",
    description: "",
    chunks: ["work permit employment authorization"]
  }, {
    url: "https://www.uscis.gov/working-in-the-united-states",
    title: "Employment Authorization",
    description: "",
    chunks: ["Official information about employment authorization."]
  }]);

  assert.equal(index.pageCount, 2);
  assert.equal(index.documents.length, 1);
  assert.equal(searchCorpus(index, "work permit", 1)[0]?.title, "Employment Authorization");
});

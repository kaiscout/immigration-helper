import test from "node:test";
import assert from "node:assert/strict";
import {
  isRelevantUscisUrl,
  normalizeUscisUrl,
  parseRobotsRules
} from "../server/uscis/config.mjs";
import { extractUscisPage } from "../server/uscis/corpus.mjs";

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

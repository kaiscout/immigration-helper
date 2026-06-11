import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const supportedLanguages = ["en", "tr", "es", "zh", "hi", "fr", "ar", "bn", "ru", "pt"];

const flattenKeys = (value, prefix = "", keys = []) => {
  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenKeys(child, path, keys);
    } else {
      keys.push(path);
    }
  });
  return keys;
};

const assertLocalizedFields = (value, location, language) => {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertLocalizedFields(child, `${location}[${index}]`, language));
    return;
  }

  if (!value || typeof value !== "object") return;

  Object.keys(value)
    .filter((key) => key.endsWith("_en"))
    .forEach((key) => {
      const localizedKey = `${key.slice(0, -3)}_${language}`;
      assert.equal(
        typeof value[localizedKey],
        "string",
        `${location}.${localizedKey} must accompany ${key}`
      );
      assert.ok(value[localizedKey].trim(), `${location}.${localizedKey} must not be empty`);
    });

  Object.entries(value).forEach(([key, child]) => {
    assertLocalizedFields(child, `${location}.${key}`, language);
  });
};

test("Portuguese UI translations have exact English key parity", () => {
  const english = flattenKeys(readJson("../i18n/en.json")).sort();
  const portuguese = flattenKeys(readJson("../i18n/pt.json")).sort();
  assert.deepEqual(portuguese, english);
});

test("All supported UI translations have exact English key parity", () => {
  const english = flattenKeys(readJson("../i18n/en.json")).sort();

  for (const language of supportedLanguages.filter((code) => code !== "en")) {
    const translated = flattenKeys(readJson(`../i18n/${language}.json`)).sort();
    assert.deepEqual(translated, english, `${language}.json must match all English translation keys`);
  }
});

test("Every supported language is registered in the picker and i18n resources", () => {
  const languageSource = fs.readFileSync(new URL("../i18n/languages.js", import.meta.url), "utf8");
  const i18nSource = fs.readFileSync(new URL("../i18n/index.js", import.meta.url), "utf8");

  for (const language of supportedLanguages) {
    assert.match(languageSource, new RegExp(`code:\\s*["']${language}["']`));
    assert.match(i18nSource, new RegExp(`${language}:\\s*\\{\\s*translation:`));
  }
});

test("Portuguese is registered in the language picker and i18n resources", () => {
  const languageSource = fs.readFileSync(new URL("../i18n/languages.js", import.meta.url), "utf8");
  const i18nSource = fs.readFileSync(new URL("../i18n/index.js", import.meta.url), "utf8");

  assert.match(languageSource, /code:\s*"pt"/);
  assert.match(languageSource, /labelKey:\s*"common\.portuguese"/);
  assert.match(i18nSource, /import pt from "\.\/pt\.json"/);
  assert.match(i18nSource, /pt:\s*\{\s*translation:\s*pt\s*\}/);
});

test("Every English flow label, title, detail, and note has Portuguese text", () => {
  for (const file of ["ead.json", "tps_renewal.json", "travel_auth.json"]) {
    assertLocalizedFields(readJson(`../data/flows/${file}`), file, "pt");
  }
});

test("Every flow has content for all supported languages", () => {
  for (const file of ["ead.json", "tps_renewal.json", "travel_auth.json"]) {
    const flow = readJson(`../data/flows/${file}`);
    for (const language of supportedLanguages.filter((code) => code !== "en")) {
      assertLocalizedFields(flow, file, language);
    }
  }
});

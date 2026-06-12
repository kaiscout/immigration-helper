import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const supportedLanguages = [
  "en", "tr", "es", "zh", "hi", "fr", "ar", "bn", "ru", "pt", "it",
  "bg", "hr", "cs", "da", "nl", "et", "fi", "de", "el", "hu", "ga",
  "lv", "lt", "mt", "pl", "ro", "sk", "sl", "sv"
];

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

const flattenValues = (value, prefix = "", values = {}) => {
  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenValues(child, path, values);
    } else {
      values[path] = child;
    }
  });
  return values;
};

const placeholders = (value) =>
  [...String(value || "").matchAll(/\{\{\s*([^},\s]+)[^}]*\}\}/g)]
    .map((match) => match[1])
    .sort();

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

test("Every translation preserves the English interpolation placeholders", () => {
  const english = flattenValues(readJson("../i18n/en.json"));

  for (const language of supportedLanguages.filter((code) => code !== "en")) {
    const translated = flattenValues(readJson(`../i18n/${language}.json`));
    for (const [key, value] of Object.entries(english)) {
      assert.deepEqual(
        placeholders(translated[key]),
        placeholders(value),
        `${language}.${key} must preserve interpolation placeholders`
      );
    }
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

test("Italian is registered in the language picker and i18n resources", () => {
  const languageSource = fs.readFileSync(new URL("../i18n/languages.js", import.meta.url), "utf8");
  const i18nSource = fs.readFileSync(new URL("../i18n/index.js", import.meta.url), "utf8");

  assert.match(languageSource, /code:\s*"it"/);
  assert.match(languageSource, /labelKey:\s*"common\.italian"/);
  assert.match(i18nSource, /import it from "\.\/it\.json"/);
  assert.match(i18nSource, /it:\s*\{\s*translation:\s*it\s*\}/);
});

test("Every English flow label, title, detail, and note has Portuguese text", () => {
  for (const file of ["ead.json", "tps_renewal.json", "travel_auth.json"]) {
    assertLocalizedFields(readJson(`../data/flows/${file}`), file, "pt");
  }
});

test("Every English flow label, title, detail, and note has Italian text", () => {
  for (const file of ["ead.json", "tps_renewal.json", "travel_auth.json"]) {
    assertLocalizedFields(readJson(`../data/flows/${file}`), file, "it");
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

test("Flows do not contain unsupported deadline calculators", () => {
  for (const file of ["ead.json", "tps_renewal.json", "travel_auth.json"]) {
    const flow = readJson(`../data/flows/${file}`);
    assert.equal(flow.deadlineLogic, undefined, `${file} must not calculate a legal deadline`);
    assert.equal(flow.calculators, undefined, `${file} must not contain fixed-offset legal calculators`);
  }
});

test("Every added EU language has local AI command and retrieval support", () => {
  const support = readJson("../data/euLanguageSupport.json");
  const addedEuLanguages = supportedLanguages.slice(11);

  for (const language of addedEuLanguages) {
    assert.ok(support[language], `${language} must have shared AI support`);
    assert.ok(support[language].summaryLabels, `${language} must have summary labels`);
    for (const key of ["open", "summary", "markDone", "undo", "question"]) {
      assert.ok(support[language].intents[key]?.length >= 3, `${language}.${key} needs intent phrases`);
    }
    for (const key of ["caseStatus", "fees", "scams", "ead", "travel", "visitorVisa"]) {
      assert.ok(support[language].topics[key]?.length >= 3, `${language}.${key} needs topic phrases`);
    }
    for (const key of ["tps", "ead", "travel"]) {
      assert.ok(support[language].flowAliases[key]?.length >= 3, `${language}.${key} needs flow aliases`);
    }
  }
});

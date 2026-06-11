import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));

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

const assertPortugueseFields = (value, location) => {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertPortugueseFields(child, `${location}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") return;

  Object.keys(value)
    .filter((key) => key.endsWith("_en"))
    .forEach((key) => {
      const portugueseKey = `${key.slice(0, -3)}_pt`;
      assert.equal(
        typeof value[portugueseKey],
        "string",
        `${location}.${portugueseKey} must accompany ${key}`
      );
      assert.ok(value[portugueseKey].trim(), `${location}.${portugueseKey} must not be empty`);
    });

  Object.entries(value).forEach(([key, child]) => {
    assertPortugueseFields(child, `${location}.${key}`);
  });
};

test("Portuguese UI translations have exact English key parity", () => {
  const english = flattenKeys(readJson("../i18n/en.json")).sort();
  const portuguese = flattenKeys(readJson("../i18n/pt.json")).sort();
  assert.deepEqual(portuguese, english);
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
    assertPortugueseFields(readJson(`../data/flows/${file}`), file);
  }
});

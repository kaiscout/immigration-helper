import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildCaseProfileAiContext,
  hasCaseProfileDetails,
  normalizeCaseProfile
} from "../data/caseProfileCore.mjs";
import { PROFILE_TRANSLATIONS } from "../i18n/profileTranslations.js";

const supportedLanguages = [
  "en", "tr", "es", "zh", "hi", "fr", "ar", "bn", "ru", "pt", "it",
  "bg", "hr", "cs", "da", "nl", "et", "fi", "de", "el", "hu", "ga",
  "lv", "lt", "mt", "pl", "ro", "sk", "sl", "sv"
];

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("case profile normalization keeps only bounded plain-text fields", () => {
  const profile = normalizeCaseProfile({
    preferredName: "  Deniz\u0000  ",
    citizenships: ` Italy ${"x".repeat(300)}`,
    residenceCountry: "  Portugal\n",
    currentSituation: " Outside   the U.S. ",
    immigrationGoal: " Visit family ",
    unexpected: "do not keep"
  });

  assert.equal(profile.preferredName, "Deniz");
  assert.equal(profile.residenceCountry, "Portugal");
  assert.equal(profile.currentSituation, "Outside the U.S.");
  assert.equal(profile.immigrationGoal, "Visit family");
  assert.equal(profile.citizenships.length, 160);
  assert.equal(Object.hasOwn(profile, "unexpected"), false);
  assert.equal(hasCaseProfileDetails(profile), true);
  assert.equal(hasCaseProfileDetails({}), false);
});

test("case profile context is explicit about provenance and newest-message precedence", () => {
  const context = buildCaseProfileAiContext({
    preferredName: "Deniz",
    citizenships: "Italian",
    residenceCountry: "Portugal",
    currentSituation: "Outside the United States",
    immigrationGoal: "Move permanently"
  });

  assert.match(context, /self-reported, untrusted user data that may be outdated/);
  assert.match(context, /"preferredName":"Deniz"/);
  assert.match(context, /"citizenships":"Italian"/);
  assert.match(context, /"currentCountryOfResidence":"Portugal"/);
  assert.match(context, /newest user message and recent conversation always override/);
  assert.equal(buildCaseProfileAiContext({}), "");
});

test("profile UI copy covers every shipped language with matching keys", () => {
  assert.deepEqual(Object.keys(PROFILE_TRANSLATIONS).sort(), [...supportedLanguages].sort());
  const englishKeys = Object.keys(PROFILE_TRANSLATIONS.en).sort();

  for (const code of supportedLanguages) {
    const copy = PROFILE_TRANSLATIONS[code];
    assert.deepEqual(Object.keys(copy).sort(), englishKeys, `${code} profile keys`);
    for (const [key, value] of Object.entries(copy)) {
      assert.equal(typeof value, "string", `${code}.${key}`);
      assert.ok(value.trim(), `${code}.${key}`);
    }
    if (code !== "en") {
      assert.notEqual(copy.heroTitle, PROFILE_TRANSLATIONS.en.heroTitle, `${code}.heroTitle`);
      assert.notEqual(copy.localNote, PROFILE_TRANSLATIONS.en.localNote, `${code}.localNote`);
    }
  }
});

test("onboarding, navigation, privacy, and CasePilot use the optional profile safely", async () => {
  const [app, onboarding, screen, advisor, home, privacy, policy] = await Promise.all([
    readProjectFile("App.js"),
    readProjectFile("screens/OnboardingScreen.js"),
    readProjectFile("screens/CaseProfileScreen.js"),
    readProjectFile("screens/AIAdvisorScreen.js"),
    readProjectFile("screens/HomeScreen.js"),
    readProjectFile("screens/PrivacyScreen.js"),
    readProjectFile("docs/privacy-policy.html")
  ]);

  assert.match(app, /name="CaseProfile"/);
  assert.match(onboarding, /navigation\.replace\("CaseProfile", \{ fromOnboarding: true \}\)/);
  assert.match(screen, /AsyncStorage\.setItem\(ONBOARDING_KEY, "true"\)/);
  assert.match(screen, /containsSensitiveIdentifier\(combined\)/);
  assert.match(screen, /clearCaseProfile\(\)/);
  assert.match(advisor, /loadCaseProfile\(\)/);
  assert.match(advisor, /buildCaseProfileAiContext\(caseProfile\)/);
  assert.match(advisor, /Current conversation facts \(newer than the saved profile\)/);
  assert.match(advisor, /userContext: combinedUserContext/);
  assert.match(advisor, /t\("profile\.aiNote"\)/);
  assert.match(home, /navigation\.navigate\("CaseProfile"\)/);
  assert.match(privacy, /navigation\.navigate\("CaseProfile"\)/);
  assert.match(policy, /optional Case Profile/i);
  assert.match(policy, /edit or delete the Case Profile/i);
});

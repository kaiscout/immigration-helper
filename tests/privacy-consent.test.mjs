import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("AI Helper requires stored consent before rendering the chat", async () => {
  const screen = await readProjectFile("screens/AIAdvisorScreen.js");

  assert.match(screen, /if \(!aiConsent\)/);
  assert.match(screen, /saveAiConsent\(\{ shareChecklist: isPlus && consentChecklist \}\)/);
  assert.match(screen, /isPlus && aiConsent\?\.shareChecklist \? contextText : ""/);
  assert.match(screen, /navigation\.navigate\("Paywall", \{ feature: "checklistAi" \}\)/);
  assert.match(screen, /redactAllowedEmailAddressesForPrivacyScan\([\s\S]*?KNOWN_PUBLIC_AGENCY_EMAILS/);
});

test("checklist sharing is optional and disabled by default", async () => {
  const consentStore = await readProjectFile("data/aiConsent.js");

  assert.match(consentStore, /shareChecklist = false/);
  assert.match(consentStore, /shareChecklist: shareChecklist === true/);
});

test("public privacy policy names AI recipients and retention", async () => {
  const policy = await readProjectFile("docs/privacy-policy.html");

  assert.match(policy, /Render/i);
  assert.match(policy, /OpenAI/i);
  assert.match(policy, /up to 30 days/i);
  assert.match(policy, /not used to train/i);
  assert.match(policy, /RevenueCat subscription analytics/i);
  assert.match(policy, /not used for advertising or cross-app tracking/i);
});

test("public privacy policy explains File Vault storage, sharing, and deletion", async () => {
  const policy = await readProjectFile("docs/privacy-policy.html");

  assert.match(policy, /private on-device app storage/i);
  assert.match(policy, /does not upload File Vault files or metadata/i);
  assert.match(policy, /deliberately use the share function/i);
  assert.match(policy, /Deleting a File Vault item deletes the app's private copy/i);
});

test("subscription paywall exposes privacy and terms links", async () => {
  const [paywall, links] = await Promise.all([
    readProjectFile("screens/PaywallScreen.js"),
    readProjectFile("constants/officialLinks.js")
  ]);

  assert.match(paywall, /OFFICIAL_LINKS\.privacy/);
  assert.match(paywall, /OFFICIAL_LINKS\.terms/);
  assert.match(links, /privacy-policy\.html/);
  assert.match(links, /apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula/);
});

test("subscription plans advertise the monthly trial and yearly best value accurately", async () => {
  const [paywall, service] = await Promise.all([
    readProjectFile("screens/PaywallScreen.js"),
    readProjectFile("data/subscriptionService.js")
  ]);

  assert.match(
    paywall,
    /key: "yearly"[\s\S]*?helper: t\("plus\.bestValue"\)[\s\S]*?key: "monthly"/
  );
  assert.match(
    paywall,
    /key: "monthly"[\s\S]*?offerings\.monthlyTrialEligibility === "eligible"[\s\S]*?t\("plus\.trial", \{ price: priceFor\("monthly"\) \}\)[\s\S]*?t\("plus\.monthlyTerms"/
  );
  assert.match(paywall, /disabled=\{!plan\.available/);
  assert.match(service, /const selected = findPlusPackage\(offerings\.packages, kind\)/);
  assert.doesNotMatch(service, /offerings\.packages\[0\]/);
});

test("Plus preview access is restricted to development builds", async () => {
  const subscriptionService = await readProjectFile("data/subscriptionService.js");

  assert.match(subscriptionService, /typeof __DEV__ !== "undefined"/);
  assert.match(subscriptionService, /__DEV__ &&/);
  assert.match(subscriptionService, /EXPO_PUBLIC_ENABLE_PLUS_PREVIEW_UNLOCK/);
  assert.match(subscriptionService, /hasUnexpiredCachedEntitlement\(stored\)/);
  assert.match(subscriptionService, /import \{[\s\S]*hasUnexpiredCachedEntitlement/);
  const subscriptionCore = await readProjectFile("data/subscriptionCore.mjs");
  assert.match(subscriptionCore, /state\?\.isPreview !== true/);
  assert.match(subscriptionCore, /expirationTime > now/);
  assert.match(subscriptionService, /isPlus: next\?\.isPreview === true \? false/);
  assert.match(subscriptionService, /isPreview: false,[\s\S]*?checkedAt:/);
});

test("Plus members can open the restored workspace and File Vault routes", async () => {
  const [app, home] = await Promise.all([
    readProjectFile("App.js"),
    readProjectFile("screens/HomeScreen.js")
  ]);

  assert.match(app, /name="PlusWorkspace"/);
  assert.match(app, /name="FileVault"/);
  assert.match(home, /navigation\.navigate\("PlusWorkspace"\)/);
  assert.match(home, /navigation\.navigate\("Paywall", \{ feature: "workspace" \}\)/);
});

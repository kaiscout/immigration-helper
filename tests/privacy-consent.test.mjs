import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("AI Helper requires stored consent before rendering the chat", async () => {
  const screen = await readProjectFile("screens/AIAdvisorScreen.js");

  assert.match(screen, /if \(!aiConsent\)/);
  assert.match(screen, /saveAiConsent\(\{ shareChecklist: consentChecklist \}\)/);
  assert.match(screen, /aiConsent\?\.shareChecklist \? contextText : ""/);
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
});

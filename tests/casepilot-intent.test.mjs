import assert from "node:assert/strict";
import test from "node:test";

import { isExplicitSavedChecklistSummary } from "../data/casePilotIntent.js";

test("does not turn a personalized relocation question into a checklist dump", () => {
  const question =
    "I am an Italian citizen living in Portugal and I want to move to the USA. " +
    "Where do I start and what do I need to do?";

  assert.equal(isExplicitSavedChecklistSummary(question), false);
});

test("keeps broad process and eligibility questions on the research path", () => {
  const questions = [
    "What steps do I need to move to the United States?",
    "What do I need for a U.S. work permit?",
    "Where should my family start if we want to immigrate?",
    "Can I move to America and work there?"
  ];

  for (const question of questions) {
    assert.equal(isExplicitSavedChecklistSummary(question), false, question);
  }
});

test("still recognizes unmistakable saved-checklist requests", () => {
  const requests = [
    "What is my checklist progress?",
    "Show my saved TPS checklist",
    "TPS progress status",
    "What is left on my checklist?"
  ];

  for (const request of requests) {
    assert.equal(isExplicitSavedChecklistSummary(request), true, request);
  }
});

test("recognizes the exact localized checklist prompt", () => {
  assert.equal(
    isExplicitSavedChecklistSummary(
      "Qual è lo stato della mia checklist?",
      ["Qual è lo stato della mia checklist?"]
    ),
    true
  );
});

test("recognizes natural localized saved-checklist requests", () => {
  const requests = [
    "Cosa manca nella mia checklist TPS?",
    "¿Cuál es el progreso de mi lista de verificación?",
    "Was bleibt auf meiner Checkliste?",
    "Co zostało na mojej liście kontrolnej?"
  ];

  for (const request of requests) {
    assert.equal(isExplicitSavedChecklistSummary(request), true, request);
  }
});

test("localized relocation and eligibility questions still use research", () => {
  const questions = [
    "Cosa devo fare per trasferirmi negli Stati Uniti?",
    "Quali passaggi devo seguire per lavorare negli Stati Uniti?",
    "Was brauche ich, um in die USA umzuziehen?",
    "Jakie kroki muszę wykonać, aby przeprowadzić się do USA?"
  ];

  for (const question of questions) {
    assert.equal(isExplicitSavedChecklistSummary(question), false, question);
  }
});

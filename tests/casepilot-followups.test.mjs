import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCasePilotFollowups } from "../data/casePilotFollowups.js";

const knownLabels = {
  documents: "Documents",
  nextSteps: "Next steps"
};

const translateKnownId = (id) => knownLabels[id] || "";

test("keeps translated built-in follow-ups", () => {
  assert.deepEqual(normalizeCasePilotFollowups(["documents"], translateKnownId), [
    { id: "documents", label: "Documents", prompt: "Documents" }
  ]);
});

test("accepts tailored server-provided answer choices", () => {
  assert.deepEqual(normalizeCasePilotFollowups([
    {
      id: "basis-family",
      label: "Close U.S. family",
      prompt: "My strongest basis is a close U.S. family member."
    },
    {
      id: "basis-investment",
      label: "Business or investment",
      prompt: "My strongest basis is a business or investment plan."
    }
  ], translateKnownId), [
    {
      id: "basis-family",
      label: "Close U.S. family",
      prompt: "My strongest basis is a close U.S. family member."
    },
    {
      id: "basis-investment",
      label: "Business or investment",
      prompt: "My strongest basis is a business or investment plan."
    }
  ]);
});

test("drops empty items, removes duplicates, and caps the list", () => {
  const normalized = normalizeCasePilotFollowups([
    {},
    { label: "Family", prompt: "Family route" },
    { label: "Family", prompt: "Family route" },
    { label: "Employment", prompt: "Employment route" },
    { label: "Study", prompt: "Study route" },
    { label: "Investment", prompt: "Investment route" }
  ], translateKnownId);

  assert.equal(normalized.length, 3);
  assert.deepEqual(normalized.map((item) => item.label), ["Family", "Employment", "Study"]);
});

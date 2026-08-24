import assert from "node:assert/strict";
import test from "node:test";

import { shouldCountCasePilotQuestion } from "../data/casePilotResponse.js";

test("counts only non-degraded CasePilot answers", () => {
  assert.equal(shouldCountCasePilotQuestion({ output_text: "Answer", degraded: false }), true);
  assert.equal(shouldCountCasePilotQuestion({ output_text: "Fallback", degraded: true }), false);
  assert.equal(shouldCountCasePilotQuestion({
    output_text: "Fallback",
    answer_profile: { degraded: true }
  }), false);
  assert.equal(shouldCountCasePilotQuestion(null), false);
});

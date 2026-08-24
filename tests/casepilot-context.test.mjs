import assert from "node:assert/strict";
import test from "node:test";

import { buildCasePilotRequestContext } from "../data/casePilotContext.js";

test("bounds request context and keeps the newest user correction", () => {
  const messages = Array.from({ length: 30 }, (_, index) => ({
    role: "user",
    text: `message-${index} ${"x".repeat(2_000)}`
  }));
  const current = {
    role: "user",
    text: "Correction: I am Portuguese and I now live in Spain."
  };

  const result = buildCasePilotRequestContext(messages, current);

  assert.ok(result.conversation.length <= 8_000);
  assert.ok(result.userContext.length <= 12_000);
  assert.match(result.userContext, /Portuguese.*Spain/);
  assert.doesNotMatch(result.userContext, /message-0\b/);
});

test("does not duplicate the current question in rendered conversation history", () => {
  const current = { role: "user", text: "My current question" };
  const result = buildCasePilotRequestContext([
    { role: "user", text: "An earlier fact" },
    { role: "assistant", text: "An earlier answer" }
  ], current);

  assert.doesNotMatch(result.conversation, /My current question/);
  assert.match(result.userContext, /An earlier fact/);
  assert.match(result.userContext, /My current question/);
});

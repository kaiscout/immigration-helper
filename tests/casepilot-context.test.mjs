import assert from "node:assert/strict";
import test from "node:test";

import { buildCasePilotRequestContext } from "../data/casePilotContext.js";
import { CASEPILOT_RELEASE_LANGUAGE_CASES } from "../data/casePilotReleaseGate.mjs";

test("bounds request context and keeps the intake anchor plus newest user correction", () => {
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
  assert.match(result.userContext, /message-0\b/);
  assert.doesNotMatch(result.userContext, /message-1\b/);
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

test("keeps an assistant's focused question at the end of a long answer", () => {
  const result = buildCasePilotRequestContext([
    {
      role: "assistant",
      text:
        `Here is the route overview. ${"Supporting explanation. ".repeat(80)}` +
        "Do you have a U.S. employer willing to sponsor you?"
    }
  ], { role: "user", text: "Yes." });

  assert.match(result.conversation, /^Assistant: Here is the route overview\./);
  assert.match(result.conversation, /Do you have a U\.S\. employer willing to sponsor you\?$/);
  assert.ok(result.conversation.length <= 8_000);
});

test("keeps a decisive fact at the end of a long user narrative", () => {
  const result = buildCasePilotRequestContext([], {
    role: "user",
    text:
      `I am an Italian citizen living in Portugal. ${"Background detail. ".repeat(90)}` +
      "My spouse is a U.S. citizen."
  });

  assert.match(result.userContext, /Italian citizen living in Portugal/);
  assert.match(result.userContext, /My spouse is a U\.S\. citizen\.$/);
  assert.ok(result.userContext.length <= 12_000);
});

test("preserves the initial planning statement and all short follow-ups when the character budget allows", () => {
  const history = [
    {
      role: "user",
      text: "I am an Italian citizen living in Portugal and want to move to the United States."
    },
    ...Array.from({ length: 12 }, (_, index) => ({
      role: "user",
      text: `Follow-up answer ${index + 1}`
    }))
  ];
  const current = {
    role: "user",
    text: "Correction: my goal is permanent residence."
  };

  const result = buildCasePilotRequestContext(history, current);

  assert.match(result.userContext, /Italian citizen living in Portugal.*United States/);
  assert.match(result.userContext, /Follow-up answer 1(?:\D|$)/);
  assert.match(result.userContext, /Follow-up answer 12/);
  assert.match(result.userContext, /goal is permanent residence/);
  assert.equal(
    result.userContext.split("\n").filter(Boolean).length,
    14
  );
});

test("retains relevant mid-conversation facts across every supported language", () => {
  for (const { code, planning, facts } of CASEPILOT_RELEASE_LANGUAGE_CASES) {
    const decisiveFact = `${code}-decisive-fact: I have a U.S. citizen spouse.`;
    const history = [
      { role: "user", text: planning },
      ...Array.from({ length: 10 }, (_, index) => ({ role: "user", text: `${code} short answer ${index + 1}` })),
      { role: "user", text: decisiveFact },
      ...Array.from({ length: 16 }, (_, index) => ({ role: "user", text: `${code} newer answer ${index + 1}` }))
    ];

    const result = buildCasePilotRequestContext(history, {
      role: "user",
      text: `${code}-latest-correction: my goal is permanent residence.`
    });

    for (const fact of facts) assert.match(result.userContext, new RegExp(fact, "iu"), `${code}: intake fact`);
    assert.match(result.userContext, new RegExp(decisiveFact, "u"), `${code}: mid-conversation fact`);
    assert.match(result.userContext, new RegExp(`${code}-latest-correction`, "u"), `${code}: latest correction`);
    assert.ok(result.userContext.length <= 12_000, `${code}: bounded context`);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { createCasePilotTestTracer, TRACE_PREFIX } from "../server/ai/test-trace.mjs";

const makeResult = (answer = "A tailored answer with official sources.") => ({
  status: 200,
  body: {
    output_text: answer,
    degraded: false,
    sources: [{ title: "USCIS", url: "https://www.uscis.gov/example" }]
  }
});

test("test tracing is disabled unless the configured session matches", () => {
  const lines = [];
  const tracer = createCasePilotTestTracer({
    expectedSession: "deniz-review-20260929",
    log: (line) => lines.push(line)
  });

  assert.equal(tracer.record({
    headers: {},
    payload: { question: "What are my options?", language: "en" },
    result: makeResult()
  }), false);
  assert.equal(tracer.record({
    headers: { "x-casepilot-test-session": "another-session" },
    payload: { question: "What are my options?", language: "en" },
    result: makeResult()
  }), false);
  assert.deepEqual(lines, []);
});

test("test tracing records only the current opted-in exchange", () => {
  const lines = [];
  const tracer = createCasePilotTestTracer({
    expectedSession: "deniz-review-20260929",
    log: (line) => lines.push(line),
    now: () => "2026-09-29T12:00:00.000Z"
  });
  const payload = {
    question: "I am Italian and live in Portugal. Where should I start?",
    language: "en",
    conversation: [{ role: "user", text: "private prior message" }],
    checklistContext: "private checklist"
  };

  assert.equal(tracer.record({
    headers: { "x-casepilot-test-session": "deniz-review-20260929" },
    payload,
    result: makeResult()
  }), true);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].startsWith(`${TRACE_PREFIX} `));
  assert.match(lines[0], /Italian and live in Portugal/);
  assert.match(lines[0], /tailored answer/);
  assert.doesNotMatch(lines[0], /private prior message|private checklist/i);
});

test("test tracing omits prompt and answer text when an identifier is detected", () => {
  const lines = [];
  const tracer = createCasePilotTestTracer({
    expectedSession: "deniz-review-20260929",
    log: (line) => lines.push(line)
  });

  assert.equal(tracer.record({
    headers: { "x-casepilot-test-session": "deniz-review-20260929" },
    payload: { question: "My A-Number is A123456789. What happens next?", language: "en" },
    result: makeResult("Use the receipt notice for the next step.")
  }), true);
  assert.match(lines[0], /omitted: sensitive identifier detected/);
  assert.doesNotMatch(lines[0], /A123456789|receipt notice/);
});

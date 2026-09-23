import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  casePilotResponseText,
  fetchCasePilotResponse,
  recordCasePilotQuestionSafely,
  shouldCountCasePilotQuestion
} from "../data/casePilotResponse.js";

test("counts only non-degraded CasePilot answers", () => {
  assert.equal(shouldCountCasePilotQuestion({ output_text: "Answer", degraded: false }), true);
  assert.equal(shouldCountCasePilotQuestion({ output_text: "Fallback", degraded: true }), false);
  assert.equal(shouldCountCasePilotQuestion({
    output_text: "Fallback",
    answer_profile: { degraded: true }
  }), false);
  assert.equal(shouldCountCasePilotQuestion(null), false);
});

test("empty or citation-only success payloads do not use a free question", () => {
  for (const data of [
    {},
    { output_text: "   " },
    { output: [] },
    { output: [{ content: [{ type: "output_text", text: "\n" }] }] },
    { output: "malformed" },
    { output: [{ content: "malformed" }] },
    { output_text: "citeturn1search0" },
    { output_text: "fileciteturn0file1" },
    { output_text: "[]()" }
  ]) {
    assert.equal(shouldCountCasePilotQuestion(data), false, JSON.stringify(data));
    assert.equal(casePilotResponseText(data, "No answer"), "No answer");
  }

  assert.equal(shouldCountCasePilotQuestion({
    output: [{ content: [{ type: "output_text", text: "A useful answer." }] }]
  }), true);
});

test("response formatting keeps answer content while removing display-only markup", () => {
  assert.equal(casePilotResponseText({
    output_text: "## Next steps\n\n**Check** your [case status](https://egov.uscis.gov/) citeturn1search0."
  }), "Next steps\n\nCheck your case status.");
  assert.equal(casePilotResponseText({
    output_text: "Read the filing instructions fileciteturn0file1 before submitting."
  }), "Read the filing instructions before submitting.");
});

test("request timeout also covers a stalled body after successful headers", async () => {
  let bodyStarted = false;
  await assert.rejects(fetchCasePilotResponse("https://example.invalid/api/ai", {}, {
    timeoutMs: 10,
    fetchImpl: async (_url, { signal }) => ({
      ok: true,
      status: 200,
      text: () => {
        bodyStarted = true;
        return new Promise((_resolve, reject) => {
          const abort = () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
          if (signal.aborted) abort();
          else signal.addEventListener("abort", abort, { once: true });
        });
      }
    })
  }), { name: "AbortError" });
  assert.equal(bodyStarted, true);
});

test("request reads JSON and preserves HTTP status for localized error handling", async () => {
  const response = {
    ok: false,
    status: 401,
    text: async () => JSON.stringify({ error: { code: "invalid_api_key" } })
  };
  const result = await fetchCasePilotResponse("https://example.invalid/api/ai", {
    method: "POST",
    body: "{}"
  }, {
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, "POST");
      assert.equal(options.body, "{}");
      assert.equal(options.signal.aborted, false);
      return response;
    }
  });
  assert.equal(result.response, response);
  assert.equal(result.data.error.code, "invalid_api_key");
});

test("malformed response JSON rejects instead of becoming a successful answer", async () => {
  await assert.rejects(fetchCasePilotResponse("https://example.invalid/api/ai", {}, {
    fetchImpl: async () => ({ ok: true, text: async () => "not JSON" })
  }), SyntaxError);
});

test("usage storage failure retains a conservative in-memory count without failing the answer", async () => {
  const storedUsage = { month: "2026-09", count: 2 };
  assert.equal(await recordCasePilotQuestionSafely(async () => storedUsage, { count: 1 }), storedUsage);
  assert.deepEqual(await recordCasePilotQuestionSafely(async () => {
    throw new Error("Storage unavailable");
  }, { month: "2026-09", count: 2 }), { month: "2026-09", count: 3 });
});

test("chat holds its sending lock through the complete progressive answer", () => {
  const screen = readFileSync(new URL("../screens/AIAdvisorScreen.js", import.meta.url), "utf8");
  const sendMessage = screen.slice(screen.indexOf("const sendMessage = async"), screen.indexOf("const progressCards ="));
  assert.match(sendMessage, /if \(!question \|\| loading \|\| sendingRef\.current\) return/);
  assert.ok(sendMessage.indexOf("sendingRef.current = true") < sendMessage.indexOf("setMessages("));
  assert.ok(sendMessage.indexOf("await appendAssistantProgressively(") < sendMessage.indexOf("setLoading(false)"));
  assert.match(sendMessage, /finally\s*\{\s*sendingRef\.current = false;\s*setLoading\(false\)/);
  assert.match(sendMessage, /recordCasePilotQuestionSafely\(recordAiQuestion, aiUsage\)/);
});

test("service failures show localized unavailability without a keyword-selected canned answer", () => {
  const screen = readFileSync(new URL("../screens/AIAdvisorScreen.js", import.meta.url), "utf8");
  assert.match(screen, /appendAssistant\(t\("ai\.requestFailed"\)\)/);
  assert.doesNotMatch(screen, /broadFallback|bestTopicKey|ai\.requestFallback/);
});

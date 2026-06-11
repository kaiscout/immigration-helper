import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalFallback,
  buildRetrievalQuery,
  createAnswerService,
  extractOutputText,
  extractSources,
  resolveResponseLanguage,
  SUPPORTED_AI_LANGUAGES
} from "../server/ai/answer.mjs";
import { createCorpusIndex } from "../server/uscis/search.mjs";

const records = [{
  url: "https://www.uscis.gov/addresschange",
  title: "How to Change Your Address",
  description: "Official address guidance",
  chunks: [
    "If you have filed an immigration benefit request with USCIS, you must notify USCIS of changes of address as soon as possible. Most people can change their address through a USCIS online account."
  ]
}, {
  url: "https://www.uscis.gov/forms/filing-guidance/preparing-for-your-biometric-services-appointment",
  title: "Preparing for Your Biometric Services Appointment",
  description: "Official biometrics guidance",
  chunks: [
    "You may reschedule a biometric services appointment through your USCIS online account before the appointment time. Follow the instructions on your appointment notice."
  ]
}];

const index = createCorpusIndex(records);

test("creates a source-backed corpus answer without an API key", async () => {
  const answer = createAnswerService({ corpusIndex: index });
  const result = await answer({
    question: "I moved. How do I change my address?",
    language: "en"
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.grounded_on, "local_uscis_corpus");
  assert.equal(result.body.degraded, true);
  assert.match(result.body.output_text, /notify USCIS of changes of address/i);
  assert.equal(result.body.sources[0].url, "https://www.uscis.gov/addresschange");
});

test("local corpus fallback uses the requested language framing", () => {
  const result = buildLocalFallback(
    "Como posso mudar meu endereço?",
    "pt-BR",
    [{
      title: records[0].title,
      url: records[0].url,
      excerpt: records[0].chunks[0]
    }]
  );

  assert.match(result.output_text, /orientação oficial do USCIS/i);
  assert.match(result.output_text, /trecho do USCIS está em inglês/i);
});

test("sends retrieved USCIS passages to the model and keeps official sources", async () => {
  let requestBody;
  const answer = createAnswerService({
    corpusIndex: index,
    apiKey: "test-key",
    model: "gpt-5.4-mini",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        output_text: "You can usually update it through your USCIS online account.",
        output: [{
          type: "web_search_call",
          action: {
            sources: [
              { title: "Change Your Address", url: "https://www.uscis.gov/addresschange" },
              { title: "Untrusted", url: "https://example.com/not-official" }
            ]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const result = await answer({
    question: "How do I change my address?",
    language: "en",
    checklistContext: "TPS: 1/5 complete."
  });

  assert.match(requestBody.input, /How to Change Your Address/);
  assert.match(requestBody.input, /TPS: 1\/5 complete/);
  assert.equal(requestBody.tool_choice, "auto");
  assert.deepEqual(requestBody.tools[0].filters.allowed_domains, ["uscis.gov"]);
  assert.equal(result.body.output_text, "You can usually update it through your USCIS online account.");
  assert.equal(result.body.sources.length, 1);
  assert.equal(result.body.degraded, false);
});

test("falls back to the USCIS corpus when the model service fails", async () => {
  const answer = createAnswerService({
    corpusIndex: index,
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new Error("network unavailable");
    }
  });
  const result = await answer({
    question: "Can I reschedule biometrics?",
    language: "en"
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.grounded_on, "local_uscis_corpus");
  assert.match(result.body.output_text, /reschedule a biometric services appointment/i);
});

test("uses the previous user question only for short follow-up retrieval", () => {
  assert.match(
    buildRetrievalQuery(
      "What about the deadline?",
      "User: USCIS sent me a request for evidence.\nAssistant: Read the notice."
    ),
    /request for evidence/
  );
  assert.equal(
    buildRetrievalQuery(
      "How do I change my address with USCIS after moving?",
      "User: Tell me about biometrics."
    ),
    "How do I change my address with USCIS after moving?"
  );
});

test("filters non-USCIS citations returned by web search", () => {
  const sources = extractSources({
    output: [{
      content: [{
        annotations: [
          { url_citation: { title: "USCIS", url: "https://www.uscis.gov/i-765" } },
          { url_citation: { title: "Other", url: "https://example.com/i-765" } }
        ]
      }]
    }]
  });
  assert.deepEqual(sources, [{ title: "USCIS", url: "https://www.uscis.gov/i-765" }]);
});

test("extracts text from tool-assisted Responses API output", () => {
  const text = extractOutputText({
    output: [{
      type: "web_search_call",
      status: "completed"
    }, {
      type: "message",
      status: "completed",
      content: [{
        type: "output_text",
        text: "Here is your USCIS answer."
      }]
    }]
  });

  assert.equal(text, "Here is your USCIS answer.");
});

test("supports every app language with an explicit response language", async () => {
  for (const [code, name] of Object.entries(SUPPORTED_AI_LANGUAGES)) {
    let requestBody;
    const answer = createAnswerService({
      corpusIndex: index,
      apiKey: "test-key",
      fetchImpl: async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({
          output_text: `${name} answer`
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    });

    const result = await answer({ question: "What does USCIS do?", language: code });
    assert.match(requestBody.input, new RegExp(`Requested response language: ${name}`));
    assert.match(requestBody.input, new RegExp(`answer in ${name}`));
    assert.equal(result.body.degraded, false);
  }
});

test("falls back to English for an unsupported language code", () => {
  assert.deepEqual(resolveResponseLanguage("xx-YY"), { code: "en", name: "English" });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalFallback,
  buildRetrievalQuery,
  createAnswerService,
  extractAnswerSections,
  extractOutputText,
  extractSources,
  OFFICIAL_IMMIGRATION_DOMAINS,
  officialDomainsForQuestion,
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
  assert.equal(requestBody.tool_choice, "required");
  assert.deepEqual(requestBody.tools[0].filters.allowed_domains, OFFICIAL_IMMIGRATION_DOMAINS);
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

test("keeps official immigration sources and filters unofficial citations", () => {
  const sources = extractSources({
    output: [{
      content: [{
        annotations: [
          { url_citation: { title: "USCIS", url: "https://www.uscis.gov/i-765" } },
          { url_citation: { title: "Visitor Visa", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html" } },
          { url_citation: { title: "I-94", url: "https://www.cbp.gov/travel/international-visitors/i-94" } },
          { url_citation: { title: "Other", url: "https://example.com/i-765" } }
        ]
      }]
    }]
  });
  assert.deepEqual(sources, [
    { title: "USCIS", url: "https://www.uscis.gov/i-765" },
    { title: "Visitor Visa", url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html" },
    { title: "I-94", url: "https://www.cbp.gov/travel/international-visitors/i-94" }
  ]);
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

test("cleans citation and markdown artifacts from conversational answers", () => {
  const text = extractOutputText({
    output_text:
      "**Commencez ici.** Consultez [la page officielle](https://travel.state.gov/visitor). " +
      "citeturn0search0 (travel.state.gov)"
  });

  assert.equal(text, "Commencez ici. Consultez la page officielle.");
});

test("keeps each official citation with the paragraph it supports", () => {
  const firstText = "L’ajustement de statut se fait auprès de l’USCIS. ([uscis.gov](https://www.uscis.gov/green-card/green-card-processes-and-procedures/adjustment-of-status))";
  const secondText = "Le traitement consulaire passe par le Département d’État. ([travel.state.gov](https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html))";
  const fullText = `${firstText}\n\n${secondText}`;
  const secondStart = firstText.length + 2;
  const sections = extractAnswerSections({
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: fullText,
        annotations: [{
          type: "url_citation",
          start_index: firstText.indexOf("([uscis.gov]"),
          end_index: firstText.length,
          title: "Adjustment of Status",
          url: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/adjustment-of-status?utm_source=openai"
        }, {
          type: "url_citation",
          start_index: secondStart + secondText.indexOf("([travel.state.gov]"),
          end_index: fullText.length,
          title: "Immigrant Visa Process",
          url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html?utm_source=openai"
        }]
      }]
    }]
  });

  assert.deepEqual(sections, [{
    text: "L’ajustement de statut se fait auprès de l’USCIS.",
    sources: [{
      title: "Adjustment of Status",
      url: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/adjustment-of-status"
    }]
  }, {
    text: "Le traitement consulaire passe par le Département d’État.",
    sources: [{
      title: "Immigrant Visa Process",
      url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html"
    }]
  }]);
});

test("canonicalizes duplicate official sources and labels their agencies", () => {
  const sources = extractSources({
    output: [{
      action: {
        sources: [{
          url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html?one=1"
        }, {
          title: "USCIS",
          url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html?two=2"
        }, {
          url: "https://www.cbp.gov/travel/international-visitors/i-94?language=es"
        }]
      }
    }]
  });

  assert.deepEqual(sources, [{
    title: "U.S. Department of State",
    url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html"
  }, {
    title: "U.S. Customs and Border Protection",
    url: "https://www.cbp.gov/travel/international-visitors/i-94"
  }]);
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

test("routes visitor-visa questions in every supported language to State and CBP", () => {
  const questions = [
    "My uncle wants to visit the United States.",
    "Amcam Amerika'yı ziyaret etmek istiyor.",
    "Mi tío quiere visitar Estados Unidos.",
    "我的叔叔想来美国旅游。",
    "मेरे चाचा अमेरिका घूमने आना चाहते हैं।",
    "Mon oncle veut visiter les États-Unis.",
    "عمي يريد زيارة الولايات المتحدة.",
    "আমার চাচা যুক্তরাষ্ট্রে বেড়াতে আসতে চান।",
    "Мой дядя хочет приехать в США в гости.",
    "Meu tio quer visitar os Estados Unidos."
  ];

  for (const question of questions) {
    assert.deepEqual(officialDomainsForQuestion(question), ["state.gov", "cbp.gov"]);
  }
});

test("gives non-English users the same conversational contract and agency access", async () => {
  let requestBody;
  const answer = createAnswerService({
    corpusIndex: index,
    apiKey: "test-key",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        output_text: "Il devrait commencer par vérifier les instructions du visa de visiteur.",
        output: [{
          type: "web_search_call",
          action: {
            sources: [{
              title: "Visitor Visa",
              url: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html"
            }]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const result = await answer({
    question: "Mon oncle turc veut visiter les États-Unis. Par où devrait-il commencer ?",
    language: "fr",
    conversation: "User: Il souhaite rester deux semaines."
  });

  assert.match(requestBody.input, /same completeness, reasoning, warmth, task awareness/);
  assert.match(requestBody.instructions, /Department of State|State Department/i);
  assert.match(requestBody.input, /Il souhaite rester deux semaines/);
  assert.deepEqual(requestBody.tools[0].filters.allowed_domains, ["state.gov", "cbp.gov"]);
  assert.equal(result.body.sources[0].url.includes("travel.state.gov"), true);
  assert.equal(result.body.degraded, false);
});

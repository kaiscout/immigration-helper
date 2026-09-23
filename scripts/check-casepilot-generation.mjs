import fs from 'node:fs';
import path from 'node:path';
import { createCorpusIndex, loadCorpus } from '../server/uscis/search.mjs';
import { createAnswerService, extractAnswerSections, responsePassesCitationGate } from '../server/ai/answer.mjs';

// Fixed synthetic fixtures only: never capture a real user's immigration conversation.
const scenarios = {
  status: { question: 'How do I check the status of a USCIS case?', language: 'en' },
  planning: { question: 'I am an Italian citizen living in Portugal and want to move to the USA permanently. Where do I start?', language: 'en' },
};
const name = process.argv[2] || 'status';
if (!scenarios[name]) throw new Error('Use the status or planning synthetic fixture.');
if (!process.env.OPENAI_API_KEY) throw new Error('Server-side API configuration is required.');
const replay = process.argv.includes('--replay')
  ? JSON.parse(fs.readFileSync(path.resolve('.expo', `synthetic-generation-${name}.json`), 'utf8')).captures[0]
  : null;
const captures = [];
const service = createAnswerService({
  corpusIndex: createCorpusIndex(loadCorpus()),
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || 'gpt-5.6-sol',
  sourceFetchImpl: fetch,
  fetchImpl: async (...args) => {
    const response = replay && captures.length === 0
      ? new Response(JSON.stringify(replay.body), { status: replay.status })
      : await fetch(...args);
    captures.push({ status: response.status, body: await response.clone().json() });
    return response;
  },
});
const started = Date.now();
const result = await service({ ...scenarios[name], conversation: [], userContext: '', checklistContext: '' });
const destination = path.resolve('.expo', `synthetic-generation-${name}${replay ? '-replay' : ''}.json`);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify({ scenario: scenarios[name], result, captures }, null, 2));
console.log(JSON.stringify({
  fixture: name, status: result.status, degraded: result.body.degraded,
  reason: result.body.degraded_reason, durationMs: Date.now() - started,
  apiCalls: captures.length - Number(Boolean(replay)), capture: destination,
  upstream: captures.map(({status, body}) => ({
    httpStatus: status, status: body.status, errorCode: body.error?.code,
    incompleteReason: body.incomplete_details?.reason,
    sectionCount: extractAnswerSections(body).length,
    ordinaryCitationGate: responsePassesCitationGate(body, extractAnswerSections(body), scenarios[name].question, 'en'),
    usage: body.usage,
  })),
}, null, 2));
if (result.status !== 200 || result.body.degraded) process.exitCode = 1;

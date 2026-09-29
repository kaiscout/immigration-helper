import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createAnswerService } from '../server/ai/answer.mjs';
import { createCorpusIndex, loadCorpus } from '../server/uscis/search.mjs';
import { CASEPILOT_RELEASE_LANGUAGE_CASES } from '../data/casePilotReleaseGate.mjs';
import { runCasePilotAcceptance } from './evaluate-casepilot.mjs';

// Exercise the real generation + review pipeline with fixed synthetic fixtures.
// Credentials are read on this machine only, and never written to the report.
if (!process.env.OPENAI_API_KEY) throw new Error('Configure the server API key before live evaluation.');
const requested = new Set((process.argv[2] || 'en,it,ar').split(','));
const scenarios = CASEPILOT_RELEASE_LANGUAGE_CASES.filter(({code}) => requested.has('all') || requested.has(code));
if (!scenarios.length || (!requested.has('all') && scenarios.length !== requested.size)) {
  throw new Error('Select supported language codes or all.');
}
const corpusIndex = createCorpusIndex(loadCorpus());
const requestTrace = new AsyncLocalStorage();
let billingBlocked = false;
// Match production: one service and corpus index, not a full startup per turn.
const answer = createAnswerService({
  corpusIndex,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || 'gpt-5.6-sol',
  sourceFetchImpl: fetch,
  fetchImpl: async (...args) => {
    const {payload, captures} = requestTrace.getStore();
    if (billingBlocked) {
      captures.push({skipped: 'billing_blocked'});
      throw Object.assign(new Error('Live evaluation stopped: API billing is unavailable.'), {name: 'EvaluationBillingBlocked'});
    }
    const upstreamStarted = Date.now();
    try {
      const response = await fetch(...args);
      const body = await response.clone().json();
      // Only fixed synthetic requests; never record authorization headers.
      const request = JSON.parse(args[1].body);
      captures.push({status: response.status, body, request, durationMs: Date.now() - upstreamStarted});
      if (body.error?.code === 'credit_balance_exhausted' || body.error?.type === 'insufficient_quota') billingBlocked = true;
      console.log(JSON.stringify({language: payload.language, phase: captures.length === 1 ? 'generation' : 'review', status: response.status, upstreamStatus: body.status, durationMs: Date.now() - upstreamStarted}));
      return response;
    } catch (error) {
      captures.push({error: error.name, durationMs: Date.now() - upstreamStarted});
      throw error;
    }
  },
});
const responses = [];
const report = path.resolve('.expo', `casepilot-live-${Date.now()}.json`);
fs.mkdirSync(path.dirname(report), {recursive: true});
const result = await runCasePilotAcceptance({
  config: { endpoint: 'https://synthetic.invalid/api/ai', clientToken: 'synthetic-fixture-only', timeoutMs: 125_000, concurrency: 2 },
  scenarios,
  fetchImpl: async (_url, {body}) => {
    const payload = JSON.parse(body);
    const captures = [];
    const started = Date.now();
    const response = await requestTrace.run({payload, captures}, () => answer(payload));
    responses.push({payload, response, captures, durationMs: Date.now() - started});
    fs.writeFileSync(report, JSON.stringify({inProgress: true, billingBlocked, responses}, null, 2));
    console.log(JSON.stringify({language: payload.language, status: response.status, degraded: response.body.degraded, reason: response.body.degraded_reason, elapsedSeconds: (Date.now() - started) / 1000}));
    return new Response(JSON.stringify(response.body), {status: response.status, headers: {'Content-Type': 'application/json'}});
  },
});
fs.writeFileSync(report, JSON.stringify({result, billingBlocked, responses}, null, 2));
console.log(`Synthetic evaluation report: ${report}`);
if (!result.pass) process.exitCode = 1;

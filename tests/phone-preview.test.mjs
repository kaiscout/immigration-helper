import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import preview from '../scripts/phone-preview.cjs';

const config = {
  EXPO_PUBLIC_AI_PROXY_URL: 'https://preview.example/api/ai',
  EXPO_PUBLIC_AI_CLIENT_TOKEN: 'fake-preview-token',
};

test('preview loads Expo local overrides and preserves shell precedence', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'phone-preview-test-'));
  try {
    await writeFile(path.join(directory, '.env'), 'EXPO_PUBLIC_AI_PROXY_URL=https://base.example/api/ai\nEXPO_PUBLIC_AI_CLIENT_TOKEN=fake-base\n');
    await writeFile(path.join(directory, '.env.local'), 'EXPO_PUBLIC_AI_PROXY_URL=https://local.example/api/ai\nEXPO_PUBLIC_AI_CLIENT_TOKEN=fake-local\n');
    const local = preview.loadPreviewEnvironment(directory, {});
    assert.equal(local.EXPO_PUBLIC_AI_PROXY_URL, 'https://local.example/api/ai');
    assert.equal(local.EXPO_PUBLIC_AI_CLIENT_TOKEN, 'fake-local');
    const shell = preview.loadPreviewEnvironment(directory, config);
    assert.equal(shell.EXPO_PUBLIC_AI_PROXY_URL, config.EXPO_PUBLIC_AI_PROXY_URL);
    assert.equal(shell.EXPO_PUBLIC_AI_CLIENT_TOKEN, config.EXPO_PUBLIC_AI_CLIENT_TOKEN);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('preview checks the selected endpoint with an authenticated empty question', async () => {
  await preview.preflightAi(config, async (url, options) => {
    assert.equal(url, config.EXPO_PUBLIC_AI_PROXY_URL);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-Immigration-Helper-Token'], config.EXPO_PUBLIC_AI_CLIENT_TOKEN);
    assert.deepEqual(JSON.parse(options.body), { question: '' });
    assert.equal(options.redirect, 'error');
    return { status: 400, json: async () => ({ error: { message: 'A question is required.' } }) };
  });
});

test('missing configuration stops before any request', async () => {
  for (const env of [{}, { EXPO_PUBLIC_AI_PROXY_URL: config.EXPO_PUBLIC_AI_PROXY_URL }, { EXPO_PUBLIC_AI_CLIENT_TOKEN: config.EXPO_PUBLIC_AI_CLIENT_TOKEN }]) {
    await assert.rejects(preview.preflightAi(env, () => assert.fail('must not fetch')), /requires an AI endpoint and its matching client token/);
  }
});

test('401 gives a configuration error without exposing credentials or response text', async () => {
  await assert.rejects(preview.preflightAi(config, async () => ({ status: 401, json: () => assert.fail('must not read response') })), error => {
    assert.match(error.message, /401 Unauthorized/);
    assert.match(error.message, /\.env\.local/);
    assert.match(error.message, /Metro was not started/);
    assert.ok(!error.message.includes(config.EXPO_PUBLIC_AI_CLIENT_TOKEN));
    return true;
  });
});

test('other status codes and other 400 errors do not pass authentication preflight', async () => {
  for (const response of [
    { status: 200, json: async () => ({}) },
    { status: 400, json: async () => ({ error: { message: 'Invalid JSON request.' } }) },
    { status: 400, json: async () => { throw new Error('not JSON'); } },
  ]) {
    await assert.rejects(preview.preflightAi(config, async () => response), /unexpected response/);
  }
});

test('network failures are sanitized before reporting', async () => {
  await assert.rejects(preview.preflightAi(config, async () => { throw new Error(config.EXPO_PUBLIC_AI_CLIENT_TOKEN); }), error => {
    assert.match(error.message, /could not reach the configured endpoint/);
    assert.ok(!error.message.includes(config.EXPO_PUBLIC_AI_CLIENT_TOKEN));
    return true;
  });
});

test('the separate Expo tunnel uses installed tools and returns its proxy origin', async () => {
  const calls = [];
  const origin = await preview.startPreviewTunnel({
    resolver: { resolveAsync: async options => { calls.push(['resolve', options]); } },
    startAsync: async options => { calls.push(['start', options]); },
    getActiveUrl: () => 'https://fake-preview.exp.direct/',
  });
  assert.equal(origin, 'https://fake-preview.exp.direct');
  assert.deepEqual(calls, [
    ['resolve', { shouldPrompt: false, autoInstall: false }],
    ['start', { timeout: 60000 }],
  ]);
});

test('an unexpected tunnel origin is rejected before Metro starts', async () => {
  await assert.rejects(preview.startPreviewTunnel({
    resolver: { resolveAsync: async () => {} },
    startAsync: async () => {},
    getActiveUrl: () => 'https://unexpected.example/',
  }), /unexpected tunnel URL/);
});

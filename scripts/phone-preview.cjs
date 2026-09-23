// Temporary phone tunnel with loopback-only dev servers. No EAS/store submission.
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const project = path.resolve(__dirname, '..');
const useTunnel = process.argv.includes('--tunnel');
const webUrl = 'http://localhost:8081';
let activeExpoUrl = null;
const sdkVersion = require(path.join(project, 'node_modules/expo/package.json')).version;
const qrRoot = path.dirname(require.resolve('qrcode-terminal/package.json', { paths: [path.join(project, 'node_modules/expo')] }));
const QRCode = require(path.join(qrRoot, 'vendor/QRCode'));
const level = require(path.join(qrRoot, 'vendor/QRCode/QRErrorCorrectLevel'));
function qr(value) {
  const code = new QRCode(-1, level.M);
  code.addData(value);
  code.make();
  let cells = '';
  const size = code.getModuleCount();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (code.isDark(y, x)) cells += `M${x + 4} ${y + 4}h1v1h-1z`;
  return `<svg viewBox="0 0 ${size + 8} ${size + 8}" shape-rendering="crispEdges" role="img" aria-label="Scan to open ${value}"><rect width="100%" height="100%" fill="white"/><path d="${cells}"/></svg>`;
}
const html = () => `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Immigration Helper — phone preview</title>
<style>body{font:16px system-ui;margin:0;padding:24px;background:#eef4ff;color:#14213d;text-align:center}main{max-width:780px;margin:auto}h1{margin-bottom:8px}section{background:white;border-radius:20px;padding:20px;margin:18px 0}svg{width:min(100%,300px)}a{color:#1d4ed8}p{line-height:1.5}.offline #codes{display:none}#status{font-weight:700}</style>
<body class="offline"><main><h1>Immigration Helper</h1><p id="status" role="status">Checking preview…</p><div id="codes"><section><h2>Open in Expo Go · SDK 57</h2><p>Scan with your iPhone Camera, then tap Open in Expo Go.</p>${activeExpoUrl ? qr(activeExpoUrl) : ''}<p><a href="${activeExpoUrl || '#'}">Open in Expo Go</a></p><p>Includes the movable Free / Plus switch. Real Apple subscription purchases still require a development or TestFlight build.</p><p><a href="${webUrl}">Browser preview on this Dell</a></p></section></div><p>Keep the Dell awake. This preview uses a temporary Expo tunnel; the phone can use Wi-Fi or cellular. This is not an App Store release.</p></main>
<script>const initialUrl=${JSON.stringify(activeExpoUrl)};async function check(){try{const r=await fetch('/health',{cache:'no-store'});const s=await r.json();if(s.ok&&s.expoUrl!==initialUrl){location.reload();return;}document.body.classList.toggle('offline',!s.ok);document.getElementById('status').textContent=s.ok?'Preview server is running':'Preview unavailable — do not scan yet';}catch{document.body.classList.add('offline');document.getElementById('status').textContent='Preview stopped — do not scan yet';}}check();setInterval(check,3000);</script></body></html>`;

async function assertPortAvailable(port, bind) {
  await new Promise((resolve, reject) => {
    const test = net.createServer();
    test.once('error', () => reject(new Error(`Port ${port} is occupied; leave its owner untouched and inspect it first.`)));
    test.listen(port, bind, () => test.close(resolve));
  });
}

function loadPreviewEnvironment(projectRoot = project, shellEnv = process.env) {
  const env = { ...shellEnv, NODE_ENV: 'development' };
  // Match Expo start's development env files; existing shell variables take precedence.
  require('@expo/env').loadProjectEnv(projectRoot, {
    mode: 'development', systemEnv: env, force: true, silent: true,
  });
  return env;
}

async function preflightAi(env, fetchImpl = fetch) {
  const endpoint = (env.EXPO_PUBLIC_AI_PROXY_URL || '').trim();
  const token = (env.EXPO_PUBLIC_AI_CLIENT_TOKEN || '').trim();
  const help = 'Set EXPO_PUBLIC_AI_PROXY_URL and EXPO_PUBLIC_AI_CLIENT_TOKEN together in .env.local or the launching shell (shell variables take precedence). Metro was not started.';
  if (!endpoint || !token) throw new Error(`Phone preview requires an AI endpoint and its matching client token. ${help}`);
  try {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch {
    throw new Error(`EXPO_PUBLIC_AI_PROXY_URL must be an absolute HTTP(S) URL without embedded credentials. ${help}`);
  }
  let response;
  try {
    // Empty questions are rejected after authentication and before any AI generation.
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Immigration-Helper-Token': token },
      body: JSON.stringify({ question: '' }),
      redirect: 'error',
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new Error(`The AI preview preflight could not reach the configured endpoint within 60 seconds, or the endpoint redirected. Check its availability and URL. ${help}`);
  }
  if (response.status === 401) {
    throw new Error(`The configured AI endpoint rejected EXPO_PUBLIC_AI_CLIENT_TOKEN (401 Unauthorized). ${help}`);
  }
  let body;
  try { body = await response.json(); } catch {}
  if (response.status !== 400 || body?.error?.message !== 'A question is required.') {
    throw new Error(`The AI preview preflight returned an unexpected response (HTTP ${response.status}); expected the empty-question validation error. ${help}`);
  }
}

async function startPreviewTunnel(tunnel) {
  // Resolve only the installed helper; this launcher never prompts or installs tools.
  await tunnel.resolver.resolveAsync({ shouldPrompt: false, autoInstall: false });
  await tunnel.startAsync({ timeout: 60000 });
  const origin = new URL(tunnel.getActiveUrl());
  if (!['http:', 'https:'].includes(origin.protocol) || !origin.hostname.endsWith('.exp.direct') || origin.username || origin.password) {
    throw new Error('Expo returned an unexpected tunnel URL. Metro was not started.');
  }
  return origin.origin;
}

async function main() {
  if (!useTunnel) throw new Error('Run node scripts/phone-preview.cjs --tunnel to preview on your phone with loopback-only local servers.');
  if (!sdkVersion.startsWith('57.')) throw new Error('Install the SDK 57 dependencies before starting this Expo Go preview.');
  await assertPortAvailable(8081, 'localhost');
  await assertPortAvailable(8082, '127.0.0.1');
  const env = { ...loadPreviewEnvironment(), REACT_NATIVE_PACKAGER_HOSTNAME: 'localhost', CI: '1' };
  await preflightAi(env);
  console.log('AI endpoint authentication verified; starting phone preview.');
  let tunnel;
  let child;
  let server;
  let stopping;
  const stop = () => stopping ||= (async () => {
    child?.kill();
    if (server?.listening) server.close();
    await tunnel?.stopAsync();
  })();
  const stopQuietly = () => { void stop().catch(() => { process.exitCode = 1; }); };
  process.once('SIGINT', stopQuietly);
  process.once('SIGTERM', stopQuietly);
  try {
    // Expo's native --tunnel binds Metro to all interfaces. Manage its tunnel
    // separately so --localhost can keep the actual dev server on loopback.
    const cliRoot = path.dirname(require.resolve('@expo/cli/package.json', { paths: [path.join(project, 'node_modules/expo')] }));
    const { AsyncNgrok } = require(path.join(cliRoot, 'build/src/start/server/AsyncNgrok'));
    tunnel = new AsyncNgrok(project, 8081);
    env.EXPO_PACKAGER_PROXY_URL = await startPreviewTunnel(tunnel);
    if (stopping) { await tunnel?.stopAsync(); return; }
    child = spawn(process.execPath, [path.join(project, 'node_modules/expo/bin/cli'), 'start', '--go', '--localhost', '--port', '8081'], { cwd: project, env, stdio: 'inherit', windowsHide: true });
  } catch (error) {
    await stop();
    throw error;
  }
  let resolvingManifest;
  server = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      let ok = false;
      try { const r = await fetch(`${webUrl}/status`, { signal: AbortSignal.timeout(1500) }); ok = r.ok && (await r.text()).includes('packager-status:running'); } catch {}
      if (ok && !activeExpoUrl) {
        resolvingManifest ||= (async () => {
          try {
            const response = await fetch(`${webUrl}/`, { headers: { 'expo-platform': 'ios', Accept: 'application/expo+json' }, signal: AbortSignal.timeout(15000) });
            const manifest = await response.json();
            const origin = new URL(manifest.launchAsset.url);
            if (manifest.runtimeVersion === 'exposdk:57.0.0' && origin.host === new URL(env.EXPO_PACKAGER_PROXY_URL).host) {
              activeExpoUrl = `exp://${origin.host}`;
            }
          } catch {} finally { resolvingManifest = null; }
        })();
        await resolvingManifest;
      }
      ok = ok && Boolean(activeExpoUrl);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok, expoUrl: activeExpoUrl }));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html());
    }
  });
  child.once('error', error => { console.error(error.message); process.exitCode = 1; stopQuietly(); });
  child.once('exit', code => { if (!stopping) process.exitCode = code || 0; stopQuietly(); });
  server.once('error', error => { console.error(error.message); process.exitCode = 1; stopQuietly(); });
  server.listen(8082, '127.0.0.1', () => console.log(`Phone QR page: http://127.0.0.1:8082 | app: ${webUrl}`));
}
module.exports = { loadPreviewEnvironment, preflightAi, startPreviewTunnel };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

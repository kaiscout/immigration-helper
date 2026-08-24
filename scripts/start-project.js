const { spawn, spawnSync } = require("child_process");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const node = process.execPath;
const expoCli = path.join(root, "node_modules", "expo", "bin", "cli");
const expectedAiServerVersion = require(path.join(root, "server", "version.cjs"));
const expectedLanguageCount = 30;
const children = new Set();
let shuttingDown = false;
let phoneLauncherServer = null;

function spawnChild(args, label) {
  const child = spawn(node, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown && (label === "Expo" || code !== 0)) {
      shutdown(code ?? (signal ? 1 : 0));
    }
  });
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  phoneLauncherServer?.close();
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 150);
}

function lanAddress() {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((address) =>
      address &&
      !address.internal &&
      (address.family === "IPv4" || address.family === 4)
    )
    .map((address) => address.address);
  return addresses.find((address) => /^192\.168\./.test(address)) ||
    addresses.find((address) => /^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(address)) ||
    addresses[0] ||
    "127.0.0.1";
}

function qrSvg(value) {
  const qrPackageRoot = path.dirname(require.resolve("qrcode-terminal/package.json", {
    paths: [path.dirname(expoCli)]
  }));
  const qrCodePath = path.join(qrPackageRoot, "vendor", "QRCode");
  const QRCode = require(qrCodePath);
  const QRErrorCorrectLevel = require(path.join(qrCodePath, "QRErrorCorrectLevel"));
  const code = new QRCode(-1, QRErrorCorrectLevel.M);
  code.addData(value);
  code.make();

  const quietZone = 4;
  const size = code.getModuleCount() + quietZone * 2;
  const modules = [];
  for (let row = 0; row < code.getModuleCount(); row += 1) {
    for (let column = 0; column < code.getModuleCount(); column += 1) {
      if (code.isDark(row, column)) {
        modules.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
      }
    }
  }
  return (
    `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Phone launcher QR code" ` +
    `shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="${size}" height="${size}" fill="#fff"/>` +
    `<path d="${modules.join("")}" fill="#000"/></svg>`
  );
}

function phoneLauncherHtml(launcherUrl, expoUrl) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Open Immigration Helper</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eef4ff; color: #14213d; }
    main { width: min(92vw, 560px); box-sizing: border-box; padding: 28px; text-align: center; background: #fff; border-radius: 24px; box-shadow: 0 16px 48px #1e3a5f24; }
    h1 { margin: 0 0 8px; font-size: clamp(24px, 5vw, 34px); }
    p { margin: 8px 0 20px; line-height: 1.5; }
    .qr { width: min(78vw, 390px); margin: 0 auto 20px; }
    .qr svg { display: block; width: 100%; height: auto; }
    .open { display: inline-block; padding: 14px 22px; border-radius: 12px; background: #2563eb; color: #fff; font-size: 18px; font-weight: 700; text-decoration: none; }
    .hint { margin-bottom: 0; color: #526175; font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <h1>Immigration Helper</h1>
    <p>Scan this QR code with the iPhone Camera.</p>
    <div class="qr">${qrSvg(launcherUrl)}</div>
    <a class="open" href="${expoUrl}">Open in Expo Go</a>
    <p class="hint">Keep this computer and the iPhone on the same Wi-Fi network.</p>
  </main>
</body>
</html>`;
}

function openBrowser(url) {
  const [command, args] = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/c", "start", "", url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];
  const browser = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  browser.unref();
}

async function aiServerHealth() {
  try {
    const response = await fetch("http://127.0.0.1:8787/health", {
      signal: AbortSignal.timeout(1_000)
    });
    const body = await response.json();
    return response.ok ? body : null;
  } catch {
    return null;
  }
}

const aiServerIsReady = (health) =>
  Boolean(
    health?.ok &&
    Number(health?.corpusPages) > 0 &&
    health?.serverVersion === expectedAiServerVersion &&
    Number(health?.supportedLanguages) === expectedLanguageCount
  );

async function stopStaleProjectAiServer() {
  const result = process.platform === "win32"
    ? spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-NetTCPConnection -State Listen -LocalPort 8787 -ErrorAction SilentlyContinue | " +
          "Select-Object -ExpandProperty OwningProcess -Unique"
      ],
      { encoding: "utf8" }
    )
    : spawnSync("lsof", ["-tiTCP:8787", "-sTCP:LISTEN"], { encoding: "utf8" });
  const pids = String(result.stdout || "").trim().split(/\s+/).filter(Boolean);
  if (!pids.length) return;

  for (const pid of pids) {
    const details = process.platform === "win32"
      ? spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter \"ProcessId = ${Number(pid)}\").CommandLine`
        ],
        { encoding: "utf8" }
      )
      : spawnSync("ps", ["-p", pid, "-o", "command="], { encoding: "utf8" });
    const command = String(details.stdout || "").replace(/\\/g, "/").toLowerCase();
    const normalizedRoot = root.replace(/\\/g, "/").toLowerCase();
    if (!command.includes("server/index.mjs") && !command.includes(normalizedRoot)) {
      throw new Error(
        `Port 8787 is occupied by another service (PID ${pid}). Stop that service before starting Immigration Helper.`
      );
    }
    process.kill(Number(pid), "SIGTERM");
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await portIsAvailable(8787)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("The previous Immigration Helper AI server did not stop cleanly.");
}

async function waitForAiServer() {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const health = await aiServerHealth();
    if (aiServerIsReady(health)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The USCIS AI server did not become ready.");
}

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
  });
}

async function availableExpoPort() {
  const preferred = Number.parseInt(process.env.EXPO_PORT || "8081", 10);
  for (let port = preferred; port < preferred + 20; port += 1) {
    if (await portIsAvailable(port)) return port;
  }
  throw new Error(`No available Expo port was found from ${preferred} to ${preferred + 19}.`);
}

async function availablePhoneLauncherPort(expoPort) {
  for (let port = 8081; port <= 8100; port += 1) {
    if (port !== expoPort && await portIsAvailable(port)) return port;
  }
  throw new Error("No port is available for the phone launcher from 8081 to 8100.");
}

async function startPhoneLauncher(expoPort) {
  const host = lanAddress();
  const launcherPort = await availablePhoneLauncherPort(expoPort);
  const expoUrl = `exp://${host}:${expoPort}`;
  const launcherUrl = `http://${host}:${launcherPort}`;
  const html = phoneLauncherHtml(launcherUrl, expoUrl);
  phoneLauncherServer = http.createServer((request, response) => {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(html);
  });
  await new Promise((resolve, reject) => {
    phoneLauncherServer.once("error", reject);
    phoneLauncherServer.listen(launcherPort, "0.0.0.0", resolve);
  });
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = host;
  console.log(`Phone launcher: ${launcherUrl}`);
  openBrowser(`http://127.0.0.1:${launcherPort}`);
}

async function main() {
  spawnSync(node, [path.join(root, "scripts", "stop-expo.js")], {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  });

  const currentHealth = await aiServerHealth();
  if (aiServerIsReady(currentHealth)) {
    console.log("USCIS AI server is already running on port 8787.");
  } else {
    if (currentHealth) {
      console.log("Restarting an outdated Immigration Helper AI server on port 8787.");
      await stopStaleProjectAiServer();
    } else if (!(await portIsAvailable(8787))) {
      await stopStaleProjectAiServer();
    }
    spawnChild(["--env-file-if-exists=.env", path.join(root, "server", "index.mjs")], "AI server");
    await waitForAiServer();
  }

  const expoPort = await availableExpoPort();
  if (expoPort !== Number.parseInt(process.env.EXPO_PORT || "8081", 10)) {
    console.log(`Port 8081 is in use by another project. Starting this app on port ${expoPort}.`);
  }
  await startPhoneLauncher(expoPort);
  console.log("Starting Expo Go over LAN. Keep the computer and phone on the same Wi-Fi network.");
  spawnChild([expoCli, "start", "--lan", "--clear", "--port", String(expoPort)], "Expo");
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (error) => {
  console.error(error);
  shutdown(1);
});

main().catch((error) => {
  console.error(error);
  shutdown(1);
});

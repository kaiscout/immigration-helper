const { spawn, spawnSync } = require("child_process");
const net = require("net");
const path = require("path");

const root = path.resolve(__dirname, "..");
const node = process.execPath;
const expoCli = path.join(root, "node_modules", "expo", "bin", "cli");
const expectedAiServerVersion = "2026-06-12.2";
const expectedLanguageCount = 30;
const children = new Set();
let shuttingDown = false;

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
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 150).unref();
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
  const result = spawnSync("lsof", ["-tiTCP:8787", "-sTCP:LISTEN"], {
    encoding: "utf8"
  });
  const pids = String(result.stdout || "").trim().split(/\s+/).filter(Boolean);
  if (!pids.length) return;

  for (const pid of pids) {
    const details = spawnSync("ps", ["-p", pid, "-o", "command="], { encoding: "utf8" });
    const command = String(details.stdout || "");
    if (!command.includes("server/index.mjs") && !command.includes(root)) {
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
  console.log("Starting Expo Go with a tunnel so phones can connect reliably.");
  spawnChild([expoCli, "start", "--tunnel", "--clear", "--port", String(expoPort)], "Expo");
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

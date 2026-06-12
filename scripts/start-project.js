const { spawn, spawnSync } = require("child_process");
const net = require("net");
const path = require("path");

const root = path.resolve(__dirname, "..");
const node = process.execPath;
const expoCli = path.join(root, "node_modules", "expo", "bin", "cli");
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
    if (!shuttingDown && label === "Expo") {
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

async function aiServerIsReady() {
  try {
    const response = await fetch("http://127.0.0.1:8787/health", {
      signal: AbortSignal.timeout(1_000)
    });
    const body = await response.json();
    return response.ok && body?.ok && Number(body?.corpusPages) > 0;
  } catch {
    return false;
  }
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

  if (await aiServerIsReady()) {
    console.log("USCIS AI server is already running on port 8787.");
  } else {
    spawnChild(["--env-file-if-exists=.env", path.join(root, "server", "index.mjs")], "AI server");
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

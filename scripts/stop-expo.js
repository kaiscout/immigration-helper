const { execSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const preferredPort = Number.parseInt(process.env.EXPO_PORT || "8081", 10);
const ports = Array.from({ length: 20 }, (_, index) => preferredPort + index);
let windowsNetstat = null;

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function listeningNodePids(port) {
  if (process.platform !== "win32") {
    return run(`lsof -nP -iTCP:${port} -sTCP:LISTEN -Fp -c node`)
      .split("\n")
      .filter((line) => line.startsWith("p"))
      .map((line) => line.slice(1));
  }

  windowsNetstat ??= run("netstat -ano -p tcp");
  return windowsNetstat
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) =>
      parts.length >= 5 &&
      parts[0].toUpperCase() === "TCP" &&
      parts[3].toUpperCase() === "LISTENING" &&
      parts[1].match(/:(\d+)$/)?.[1] === String(port)
    )
    .map((parts) => parts.at(-1));
}

function processCommand(pid) {
  if (process.platform !== "win32") return run(`ps -p ${pid} -o command=`);
  return run(
    `powershell.exe -NoProfile -Command "(Get-CimInstance Win32_Process ` +
    `-Filter 'ProcessId = ${Number(pid)}').CommandLine"`
  );
}

for (const port of ports) {
  const pids = [...new Set(listeningNodePids(port))];

  for (const pid of pids) {
    const command = processCommand(pid).replace(/\\/g, "/").toLowerCase();
    const normalizedRoot = projectRoot.replace(/\\/g, "/").toLowerCase();
    const isThisExpo =
      (command.includes("expo start") || command.includes("expo/bin/cli start")) &&
      command.includes(normalizedRoot);

    if (!isThisExpo) continue;

    try {
      process.kill(Number(pid), "SIGTERM");
      console.log(`Stopped Expo server on port ${port} (pid ${pid}).`);
    } catch {
      // It may have already exited.
    }
  }
}

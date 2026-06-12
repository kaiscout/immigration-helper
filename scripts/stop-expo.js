const { execSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const preferredPort = Number.parseInt(process.env.EXPO_PORT || "8081", 10);
const ports = Array.from({ length: 20 }, (_, index) => preferredPort + index);

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

for (const port of ports) {
  const output = run(`lsof -nP -iTCP:${port} -sTCP:LISTEN -Fp -c node`);
  const pids = [...new Set(output.split("\n").filter((line) => line.startsWith("p")).map((line) => line.slice(1)))];

  for (const pid of pids) {
    const command = run(`ps -p ${pid} -o command=`);
    const isThisExpo =
      (command.includes("expo start") || command.includes("expo/bin/cli start")) &&
      command.includes(projectRoot);

    if (!isThisExpo) continue;

    try {
      process.kill(Number(pid), "SIGTERM");
      console.log(`Stopped Expo server on port ${port} (pid ${pid}).`);
    } catch {
      // It may have already exited.
    }
  }
}

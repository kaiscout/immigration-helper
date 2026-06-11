const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const model = "gpt-5.4-mini";

function readHidden(prompt) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      console.error("Run this command in an interactive terminal.");
      process.exit(1);
    }

    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let value = "";

    const onData = (character) => {
      if (character === "\u0003") {
        process.stdout.write("\n");
        process.exit(130);
      }
      if (character === "\r" || character === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value.trim());
        return;
      }
      if (character === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += character;
    };

    process.stdin.on("data", onData);
  });
}

function parseEnv(content) {
  return String(content || "")
    .split(/\r?\n/)
    .reduce((result, line) => {
      const index = line.indexOf("=");
      if (index <= 0 || line.trimStart().startsWith("#")) return result;
      result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
      return result;
    }, {});
}

function serializeEnv(values) {
  return [
    "# Server-only OpenAI configuration. This file is ignored by Git.",
    `OPENAI_API_KEY=${values.OPENAI_API_KEY}`,
    `OPENAI_MODEL=${values.OPENAI_MODEL || model}`,
    "USCIS_VECTOR_STORE_ID=",
    "PORT=8787",
    "ALLOWED_ORIGIN=*",
    "",
    "# Public production builds should point to the deployed backend.",
    `EXPO_PUBLIC_AI_PROXY_URL=${values.EXPO_PUBLIC_AI_PROXY_URL || ""}`,
    `EXPO_PUBLIC_OPENAI_MODEL=${values.EXPO_PUBLIC_OPENAI_MODEL || model}`,
    ""
  ].join("\n");
}

async function validateKey(apiKey) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  throw new Error(body?.error?.message || `OpenAI returned HTTP ${response.status}.`);
}

async function main() {
  console.log("The key will be stored only in .env and will not be displayed.");
  const apiKey = await readHidden("Paste your OpenAI API key, then press Enter: ");

  if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
    throw new Error("That does not look like a complete OpenAI API key.");
  }

  process.stdout.write("Checking the key with OpenAI...");
  await validateKey(apiKey);
  process.stdout.write(" valid.\n");

  const existing = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, "utf8")) : {};
  fs.writeFileSync(
    envPath,
    serializeEnv({ ...existing, OPENAI_API_KEY: apiKey }),
    { encoding: "utf8", mode: 0o600 }
  );
  fs.chmodSync(envPath, 0o600);

  console.log("Saved securely to .env.");
  console.log("Run npm start to restart the AI server and Expo.");
}

main().catch((error) => {
  console.error(`\nSetup failed: ${error.message || error}`);
  process.exit(1);
});

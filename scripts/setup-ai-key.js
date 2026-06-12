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
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      resolve(
        value
          .replace(/\u001b\[[0-9;]*[A-Za-z~]/g, "")
          .replace(/\s+/g, "")
          .trim()
      );
    };

    const onData = (chunk) => {
      if (chunk.includes("\u0003")) {
        process.stdout.write("\n");
        process.exit(130);
      }

      const newlineIndex = chunk.search(/[\r\n]/);
      if (newlineIndex >= 0) {
        value += chunk.slice(0, newlineIndex);
        finish();
        return;
      }

      for (const character of chunk) {
        if (character === "\u007f") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
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
    `USCIS_VECTOR_STORE_ID=${values.USCIS_VECTOR_STORE_ID || ""}`,
    `AI_PROXY_CLIENT_TOKEN=${values.AI_PROXY_CLIENT_TOKEN || values.EXPO_PUBLIC_AI_CLIENT_TOKEN || ""}`,
    `REQUIRE_AI_GENERATION=${values.REQUIRE_AI_GENERATION || "true"}`,
    `REQUIRE_CLIENT_TOKEN=${values.REQUIRE_CLIENT_TOKEN || "true"}`,
    `PORT=${values.PORT || "8787"}`,
    `ALLOWED_ORIGIN=${values.ALLOWED_ORIGIN || "*"}`,
    "",
    "# Public production builds should point to the deployed backend.",
    `EXPO_PUBLIC_AI_PROXY_URL=${values.EXPO_PUBLIC_AI_PROXY_URL || ""}`,
    `EXPO_PUBLIC_AI_CLIENT_TOKEN=${values.EXPO_PUBLIC_AI_CLIENT_TOKEN || ""}`,
    ""
  ].join("\n");
}

async function validateKey(apiKey) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (response.ok) return;
  if (response.status === 401) {
    throw new Error(
      "OpenAI rejected that key. Create a fresh key and copy it from the one-time creation window."
    );
  }
  const body = await response.json().catch(() => ({}));
  throw new Error(body?.error?.message || `OpenAI returned HTTP ${response.status}.`);
}

async function main() {
  console.log("The key will be stored only in .env and will not be displayed.");
  let apiKey = "";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    apiKey = await readHidden("Paste your newly created OpenAI API key, then press Enter: ");

    if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey) || apiKey.length > 500) {
      console.error("That paste was not one complete OpenAI API key. Please try again.");
      continue;
    }

    process.stdout.write(`Captured ${apiKey.length} characters securely. Checking with OpenAI...`);
    try {
      await validateKey(apiKey);
      process.stdout.write(" valid.\n");
      break;
    } catch (error) {
      process.stdout.write(" rejected.\n");
      console.error(error.message);
      apiKey = "";
    }
  }

  if (!apiKey) {
    throw new Error("No valid key was saved after three attempts.");
  }

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

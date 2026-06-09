const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;

      const index = trimmed.indexOf("=");
      if (index === -1) return acc;

      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      acc[key] = value;
      return acc;
    }, {});
}

function isPlaceholder(value) {
  return !value || /your[_-]?openai|your[_-]?api|replace|paste|example|placeholder/i.test(value);
}

async function main() {
  const localEnv = parseEnv(envPath);
  const exampleEnv = parseEnv(examplePath);
  const read = (key) => process.env[key] || localEnv[key] || exampleEnv[key] || "";
  const apiKey = read("EXPO_PUBLIC_OPENAI_API_KEY").trim();
  const proxyUrl = read("EXPO_PUBLIC_AI_PROXY_URL").trim();
  const model = read("EXPO_PUBLIC_OPENAI_MODEL").trim() || "gpt-4.1-mini";
  const live = process.argv.includes("--live");

  if (proxyUrl) {
    console.log(`AI configured through proxy: ${proxyUrl}`);
    console.log("No client-side OpenAI key is required for the app bundle.");
    return;
  }

  if (isPlaceholder(apiKey)) {
    console.error("Open-ended AI is not configured yet.");
    console.error("Create .env from .env.example and set EXPO_PUBLIC_OPENAI_API_KEY.");
    console.error("For public store builds, prefer EXPO_PUBLIC_AI_PROXY_URL instead.");
    process.exit(1);
  }

  console.log(`OpenAI API key is present for local Expo testing. Model: ${model}`);
  console.log("Restart Expo with npm start so Metro reloads environment variables.");

  if (!live) return;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: "Reply with only: OK"
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(data?.error?.message || "OpenAI request failed.");
    process.exit(1);
  }

  console.log(`Live OpenAI test succeeded: ${data.output_text || "OK"}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

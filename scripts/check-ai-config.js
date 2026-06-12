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
  const serverApiKey = read("OPENAI_API_KEY").trim();
  const proxyUrl = read("EXPO_PUBLIC_AI_PROXY_URL").trim();
  const proxyToken = read("EXPO_PUBLIC_AI_CLIENT_TOKEN").trim();
  const model = read("OPENAI_MODEL").trim() || "gpt-5.4-mini";
  const live = process.argv.includes("--live");

  if (proxyUrl) {
    console.log(`AI configured through proxy: ${proxyUrl}`);
    console.log("No client-side OpenAI key is required for the app bundle.");
    if (!proxyToken) {
      console.error("EXPO_PUBLIC_AI_CLIENT_TOKEN is missing.");
      process.exit(1);
    }
    return;
  }

  const apiKey = serverApiKey;
  if (isPlaceholder(apiKey)) {
    console.log("USCIS corpus fallback is ready and does not require an API key.");
    console.log("Fully generated multilingual answers are not configured yet.");
    console.log("Set server-only OPENAI_API_KEY in .env, then restart with npm start.");
    return;
  }

  console.log(`OpenAI generation is configured. Model: ${model}`);
  console.log("The key is server-only and will not be bundled into the app.");
  console.log("Restart with npm start so the AI server reloads environment variables.");

  if (!live) return;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: "Reply with only: OK",
      store: false
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(data?.error?.message || "OpenAI request failed.");
    process.exit(1);
  }

  const output = (data.output || [])
    .flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")
    ?.text;
  console.log(`Live OpenAI test succeeded: ${output || "OK"}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

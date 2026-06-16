import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createAnswerService, SUPPORTED_AI_LANGUAGES } from "./ai/answer.mjs";
import { createCorpusIndex, loadCorpus } from "./uscis/search.mjs";

const SERVER_VERSION = "2026-06-16.1";
const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = (process.env.OPENAI_MODEL || "gpt-5.4-mini").trim();
const VECTOR_STORE_ID = (process.env.USCIS_VECTOR_STORE_ID || "").trim();
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || "*").trim();
const CLIENT_TOKEN = (
  process.env.AI_PROXY_CLIENT_TOKEN ||
  (process.env.NODE_ENV !== "production" ? process.env.EXPO_PUBLIC_AI_CLIENT_TOKEN : "") ||
  ""
).trim();
const REQUIRE_AI_GENERATION = process.env.REQUIRE_AI_GENERATION === "true";
const REQUIRE_CLIENT_TOKEN = process.env.REQUIRE_CLIENT_TOKEN !== "false";
const MAX_BODY_BYTES = 64 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 30;
const MAX_RATE_LIMIT_CLIENTS = 10_000;
const requestLog = new Map();
let rateLimitChecks = 0;

if (REQUIRE_AI_GENERATION && !OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required when REQUIRE_AI_GENERATION=true.");
}
if (REQUIRE_CLIENT_TOKEN && !CLIENT_TOKEN) {
  throw new Error(
    "AI_PROXY_CLIENT_TOKEN is required in production. Local development may use EXPO_PUBLIC_AI_CLIENT_TOKEN."
  );
}

const corpus = loadCorpus();
const corpusIndex = createCorpusIndex(corpus);
const answerQuestion = createAnswerService({
  corpusIndex,
  apiKey: OPENAI_API_KEY,
  model: OPENAI_MODEL,
  vectorStoreId: VECTOR_STORE_ID
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Headers": "Content-Type, X-Immigration-Helper-Token",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  };
}

function authorized(request) {
  if (!CLIENT_TOKEN) return true;
  const supplied = String(request.headers["x-immigration-helper-token"] || "");
  const expectedBuffer = Buffer.from(CLIENT_TOKEN);
  const suppliedBuffer = Buffer.from(supplied);
  return suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function sendJson(response, status, body) {
  response.writeHead(status, corsHeaders());
  response.end(JSON.stringify(body));
}

function clientAddress(request) {
  const forwarded = request.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || request.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function withinRateLimit(request) {
  const now = Date.now();
  rateLimitChecks += 1;
  if (rateLimitChecks % 100 === 0) {
    for (const [key, timestamps] of requestLog) {
      const recent = timestamps.filter((time) => now - time < RATE_WINDOW_MS);
      if (recent.length) requestLog.set(key, recent);
      else requestLog.delete(key);
    }
  }

  while (requestLog.size >= MAX_RATE_LIMIT_CLIENTS) {
    requestLog.delete(requestLog.keys().next().value);
  }

  const address = clientAddress(request);
  const recent = (requestLog.get(address) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  requestLog.set(address, recent);
  return true;
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw new Error("REQUEST_TOO_LARGE");
    }
  }
  return body ? JSON.parse(body) : {};
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      corpusPages: corpusIndex.pageCount,
      corpusChunks: corpusIndex.documents.length,
      aiGenerationConfigured: Boolean(OPENAI_API_KEY),
      clientTokenRequired: REQUIRE_CLIENT_TOKEN,
      model: OPENAI_MODEL,
      serverVersion: SERVER_VERSION,
      supportedLanguages: Object.keys(SUPPORTED_AI_LANGUAGES).length,
      vectorStoreConfigured: Boolean(VECTOR_STORE_ID)
    });
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/ai") {
    sendJson(response, 404, { error: { message: "Not found." } });
    return;
  }

  if (!authorized(request)) {
    sendJson(response, 401, { error: { message: "Unauthorized." } });
    return;
  }

  if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    sendJson(response, 415, { error: { message: "Content-Type must be application/json." } });
    return;
  }

  if (!withinRateLimit(request)) {
    sendJson(response, 429, {
      error: { message: "Too many requests. Please wait a few minutes and try again." }
    });
    return;
  }

  try {
    const payload = await readJson(request);
    const result = await answerQuestion(payload);
    sendJson(response, result.status, result.body);
  } catch (error) {
    if (error.message === "REQUEST_TOO_LARGE") {
      sendJson(response, 413, { error: { message: "Request body is too large." } });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: { message: "Invalid JSON request." } });
      return;
    }
    console.error("AI request failed:", error?.message || error);
    sendJson(response, 500, { error: { message: "The AI service could not answer right now." } });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`USCIS AI proxy listening on http://localhost:${PORT}`);
  console.log(
    `Loaded ${corpusIndex.pageCount} USCIS page(s) and ` +
    `${corpusIndex.documents.length} searchable passage(s).`
  );
});

function shutdown(signal) {
  console.log(`${signal} received. Closing USCIS AI proxy.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

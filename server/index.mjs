import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import Redis from "ioredis";
import { shouldCountCasePilotQuestion } from "../data/casePilotResponseCore.mjs";
import {
  casePilotPayloadForAccess,
  createCasePilotAccessService,
  createMemoryAccessStore,
  createRedisAccessStore,
  createRevenueCatEntitlementVerifier
} from "./ai/access-control.mjs";
import { createAnswerService, SUPPORTED_AI_LANGUAGES } from "./ai/answer.mjs";
import { createCasePilotTestTracer } from "./ai/test-trace.mjs";
import { createCorsPolicy, trustedClientAddress } from "./http/security.mjs";
import { createCorpusIndex, loadCorpus } from "./uscis/search.mjs";
import SERVER_VERSION from "./version.cjs";

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_RENDER = process.env.RENDER === "true";
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = (process.env.OPENAI_MODEL || "gpt-5.6-sol").trim();
const OPENAI_REVIEW_MODEL = (process.env.OPENAI_REVIEW_MODEL || "gpt-5.6-luna").trim();
const VECTOR_STORE_ID = (process.env.USCIS_VECTOR_STORE_ID || "").trim();
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || (IS_PRODUCTION ? "" : "*")).trim();
const CLIENT_TOKEN = (
  process.env.AI_PROXY_CLIENT_TOKEN ||
  (!IS_PRODUCTION ? process.env.EXPO_PUBLIC_AI_CLIENT_TOKEN : "") ||
  ""
).trim();
const REQUIRE_AI_GENERATION = process.env.REQUIRE_AI_GENERATION === "true";
const REQUIRE_CLIENT_TOKEN = process.env.REQUIRE_CLIENT_TOKEN !== "false";
const REQUIRE_AI_ACCESS_CONTROL = process.env.REQUIRE_AI_ACCESS_CONTROL === "true" || IS_PRODUCTION;
const REDIS_URL = (process.env.REDIS_URL || "").trim();
const REVENUECAT_API_KEY = (process.env.REVENUECAT_API_KEY || "").trim();
const PLUS_ENTITLEMENT_ID = (process.env.PLUS_ENTITLEMENT_ID || "immigration_helper_plus").trim();
const CASEPILOT_TEST_TRACE_SESSION = (process.env.CASEPILOT_TEST_TRACE_SESSION || "").trim();
const MAX_BODY_BYTES = 64 * 1024;

if (REQUIRE_AI_GENERATION && !OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required when REQUIRE_AI_GENERATION=true.");
}
if (REQUIRE_CLIENT_TOKEN && !CLIENT_TOKEN) {
  throw new Error(
    "AI_PROXY_CLIENT_TOKEN is required in production. Local development may use EXPO_PUBLIC_AI_CLIENT_TOKEN."
  );
}
if (REQUIRE_AI_ACCESS_CONTROL && (!REDIS_URL || !REVENUECAT_API_KEY)) {
  throw new Error(
    "REDIS_URL and REVENUECAT_API_KEY are required when REQUIRE_AI_ACCESS_CONTROL=true."
  );
}

const corsPolicy = createCorsPolicy(ALLOWED_ORIGIN, { production: IS_PRODUCTION });
let accessStore;
if (REDIS_URL) {
  const redis = new Redis(REDIS_URL, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1
  });
  await redis.connect();
  accessStore = createRedisAccessStore(redis);
} else {
  accessStore = createMemoryAccessStore();
}

const verifyEntitlement = createRevenueCatEntitlementVerifier({
  apiKey: REVENUECAT_API_KEY,
  entitlementId: PLUS_ENTITLEMENT_ID
}) || (async () => false);
const accessService = createCasePilotAccessService({
  store: accessStore,
  verifyEntitlement,
  freeLimit: process.env.FREE_AI_QUESTION_LIMIT,
  subjectWindowLimit: process.env.CASEPILOT_SUBJECT_WINDOW_LIMIT,
  ipWindowLimit: process.env.CASEPILOT_IP_WINDOW_LIMIT,
  globalDailyLimit: process.env.CASEPILOT_GLOBAL_DAILY_LIMIT,
  windowSeconds: process.env.CASEPILOT_RATE_WINDOW_SECONDS
});

const corpusIndex = createCorpusIndex(loadCorpus());
const answerQuestion = createAnswerService({
  corpusIndex,
  apiKey: OPENAI_API_KEY,
  model: OPENAI_MODEL,
  reviewModel: OPENAI_REVIEW_MODEL,
  vectorStoreId: VECTOR_STORE_ID
});
const testTracer = createCasePilotTestTracer({
  expectedSession: CASEPILOT_TEST_TRACE_SESSION
});

function responseHeaders(request) {
  return {
    ...corsPolicy.headers(request?.headers?.origin),
    "Access-Control-Allow-Headers": [
      "Content-Type",
      "X-Immigration-Helper-Token",
      "X-CasePilot-App-User-Id",
      "X-CasePilot-Request-Id",
      "X-CasePilot-Refresh-Entitlement",
      "X-CasePilot-Test-Session"
    ].join(", "),
    "Access-Control-Allow-Methods": "POST,OPTIONS",
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

function sendJson(request, response, status, body) {
  response.writeHead(status, responseHeaders(request));
  response.end(JSON.stringify(body));
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
  if (!corsPolicy.allows(request.headers.origin)) {
    sendJson(request, response, 403, {
      error: { code: "origin_not_allowed", message: "Origin not allowed." }
    });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, responseHeaders(request));
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(request, response, 200, {
      ok: true,
      accessControlConfigured: Boolean(REDIS_URL && REVENUECAT_API_KEY),
      corpusPages: corpusIndex.pageCount,
      corpusChunks: corpusIndex.documents.length,
      aiGenerationConfigured: Boolean(OPENAI_API_KEY),
      clientTokenRequired: REQUIRE_CLIENT_TOKEN,
      model: OPENAI_MODEL,
      reviewModel: OPENAI_REVIEW_MODEL,
      serverVersion: SERVER_VERSION,
      supportedLanguages: Object.keys(SUPPORTED_AI_LANGUAGES).length,
      testTraceConfigured: testTracer.configured,
      vectorStoreConfigured: Boolean(VECTOR_STORE_ID)
    });
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/ai") {
    sendJson(request, response, 404, { error: { message: "Not found." } });
    return;
  }

  if (!authorized(request)) {
    sendJson(request, response, 401, { error: { message: "Unauthorized." } });
    return;
  }

  if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    sendJson(request, response, 415, { error: { message: "Content-Type must be application/json." } });
    return;
  }

  let payload;
  let authorization;
  try {
    payload = await readJson(request);
    authorization = await accessService.authorize({
      appUserId: request.headers["x-casepilot-app-user-id"],
      requestId: request.headers["x-casepilot-request-id"],
      refreshEntitlement: request.headers["x-casepilot-refresh-entitlement"] === "true",
      clientAddress: trustedClientAddress(request, { trustForwardedFor: IS_RENDER })
    });
    if (!authorization.allowed) {
      sendJson(request, response, authorization.status, authorization.body);
      return;
    }

    const authorizedPayload = casePilotPayloadForAccess(payload, authorization);
    const result = await answerQuestion(authorizedPayload);
    const countQuestion = shouldCountCasePilotQuestion(result.body);
    await accessService.finalize(authorization.reservation, {
      countQuestion,
      countGlobal: result.status >= 200 && result.status < 300
    });
    testTracer.record({ headers: request.headers, payload: authorizedPayload, result });
    sendJson(request, response, result.status, {
      ...result.body,
      ...(countQuestion ? { access: authorization.access } : {})
    });
  } catch (error) {
    if (authorization?.allowed) {
      await accessService.finalize(authorization.reservation, { countQuestion: false }).catch(() => {});
    }
    if (error.message === "REQUEST_TOO_LARGE") {
      sendJson(request, response, 413, { error: { message: "Request body is too large." } });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(request, response, 400, { error: { message: "Invalid JSON request." } });
      return;
    }
    console.error("AI request failed:", error?.message || error);
    testTracer.record({
      headers: request.headers,
      payload,
      result: { status: 500, body: { degraded: true, degraded_reason: "server_error" } }
    });
    sendJson(request, response, 500, { error: { message: "The AI service could not answer right now." } });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`USCIS AI proxy listening on http://localhost:${PORT}`);
  console.log(
    `Loaded ${corpusIndex.pageCount} USCIS page(s) and ` +
    `${corpusIndex.documents.length} searchable passage(s).`
  );
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Closing USCIS AI proxy.`);
  server.close(async () => {
    await accessService.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

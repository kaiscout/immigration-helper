import assert from "node:assert/strict";
import test from "node:test";

import {
  casePilotPayloadForAccess,
  createCasePilotAccessService,
  createMemoryAccessStore,
  createRevenueCatEntitlementVerifier,
  normalizeCasePilotAppUserId,
  normalizeCasePilotRequestId
} from "../server/ai/access-control.mjs";
import { createCorsPolicy, trustedClientAddress } from "../server/http/security.mjs";

const identity = "$RCAnonymousID:1234567890abcdef";
const requestId = (number) => `request_${String(number).padStart(12, "0")}`;

const serviceFor = ({ isPlus = false, verifyEntitlement, ...options } = {}) => {
  const timestamp = new Date("2026-10-02T12:00:00.000Z");
  return createCasePilotAccessService({
    store: createMemoryAccessStore({ now: () => timestamp.getTime() }),
    verifyEntitlement: verifyEntitlement || (async () => isPlus),
    now: () => timestamp,
    ...options
  });
};

test("access control rejects missing or malformed installation and request identities", async () => {
  const service = serviceFor();
  assert.equal(normalizeCasePilotAppUserId("bad id"), "");
  assert.equal(normalizeCasePilotRequestId("short"), "");
  assert.equal((await service.authorize({ requestId: requestId(1) })).status, 401);
  const missingRequest = await service.authorize({ appUserId: identity });
  assert.equal(missingRequest.status, 400);
  assert.equal(missingRequest.body.error.code, "request_id_required");
});

test("the server strips Plus-only checklist context from free requests", () => {
  const payload = {
    question: "What should I do next?",
    profileContext: { citizenship: "Italian" },
    checklistContext: { completed: ["passport"] }
  };
  assert.deepEqual(casePilotPayloadForAccess(payload, { isPlus: false }), {
    question: payload.question,
    profileContext: payload.profileContext
  });
  assert.equal(casePilotPayloadForAccess(payload, { isPlus: true }), payload);
});

test("RevenueCat verification recognizes active, lifetime, expired, and missing entitlements", async () => {
  const calls = [];
  const verifierFor = (entitlement, status = 200) => createRevenueCatEntitlementVerifier({
    apiKey: "secret",
    entitlementId: "immigration_helper_plus",
    now: () => new Date("2026-10-02T12:00:00.000Z"),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => ({ subscriber: { entitlements: entitlement ? {
          immigration_helper_plus: entitlement
        } : {} } })
      };
    }
  });

  assert.deepEqual(await verifierFor({ expires_date: "2026-11-01T00:00:00Z" })(identity), {
    recognized: true,
    isPlus: true
  });
  assert.deepEqual(await verifierFor({ expires_date: null })(identity), {
    recognized: true,
    isPlus: true
  });
  assert.deepEqual(await verifierFor({ expires_date: "2026-09-01T00:00:00Z" })(identity), {
    recognized: true,
    isPlus: false
  });
  assert.deepEqual(await verifierFor(null, 404)(identity), {
    recognized: false,
    isPlus: false
  });
  assert.match(calls[0].url, /\/v1\/subscribers\/\%24RCAnonymousID\%3A/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret");
});

test("unknown RevenueCat identities are rejected instead of receiving fresh free quotas", async () => {
  const service = serviceFor({
    verifyEntitlement: async () => ({ recognized: false, isPlus: false })
  });
  const result = await service.authorize({ appUserId: identity, requestId: requestId(1) });
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, "access_identity_unrecognized");
});

test("the server atomically allows ten free answers and rejects the eleventh", async () => {
  const service = serviceFor({ subjectWindowLimit: 100, ipWindowLimit: 100 });
  const attempts = await Promise.all(Array.from({ length: 12 }, async (_, index) =>
    service.authorize({ appUserId: identity, requestId: requestId(index), clientAddress: "203.0.113.10" })
  ));
  const allowed = attempts.filter((attempt) => attempt.allowed);
  const denied = attempts.filter((attempt) => !attempt.allowed);
  assert.equal(allowed.length, 10);
  assert.equal(denied.length, 2);
  assert.ok(denied.every((attempt) => attempt.status === 402));
  assert.equal(denied[0].body.access.usage.used, 10);
  assert.equal(denied[0].body.access.usage.remaining, 0);
});

test("Plus is verified server-side and bypasses only the monthly free counter", async () => {
  let verificationCalls = 0;
  const service = serviceFor({
    verifyEntitlement: async () => {
      verificationCalls += 1;
      return true;
    },
    subjectWindowLimit: 2,
    ipWindowLimit: 10
  });
  const first = await service.authorize({ appUserId: identity, requestId: requestId(1), clientAddress: "203.0.113.10" });
  const second = await service.authorize({ appUserId: identity, requestId: requestId(2), clientAddress: "203.0.113.10" });
  const third = await service.authorize({ appUserId: identity, requestId: requestId(3), clientAddress: "203.0.113.10" });
  assert.equal(first.access.isPlus, true);
  assert.equal(second.access.isPlus, true);
  assert.equal(third.body.error.code, "subject_rate_limited");
  assert.equal(verificationCalls, 1, "entitlement result should be cached briefly");
});

test("a client that just purchased can force a fresh server-side entitlement check", async () => {
  let isPlus = false;
  let verificationCalls = 0;
  const service = serviceFor({
    verifyEntitlement: async () => {
      verificationCalls += 1;
      return isPlus;
    }
  });
  const free = await service.authorize({ appUserId: identity, requestId: requestId(1) });
  assert.equal(free.access.isPlus, false);
  isPlus = true;
  const refreshed = await service.authorize({
    appUserId: identity,
    requestId: requestId(2),
    refreshEntitlement: true
  });
  assert.equal(refreshed.access.isPlus, true);
  assert.equal(verificationCalls, 2);
});

test("degraded answers and pre-generation entitlement failures release retry and free-quota reservations", async () => {
  const service = serviceFor();
  const first = await service.authorize({ appUserId: identity, requestId: requestId(1), clientAddress: "203.0.113.10" });
  assert.equal(first.allowed, true);
  await service.finalize(first.reservation, { countQuestion: false });
  const retried = await service.authorize({ appUserId: identity, requestId: requestId(1), clientAddress: "203.0.113.10" });
  assert.equal(retried.allowed, true);
  assert.equal(retried.access.usage.used, 1);

  let unavailable = true;
  const entitlementService = serviceFor({
    verifyEntitlement: async () => {
      if (unavailable) throw new Error("RevenueCat unavailable");
      return false;
    }
  });
  const failed = await entitlementService.authorize({ appUserId: identity, requestId: requestId(2) });
  assert.equal(failed.body.error.code, "entitlement_check_unavailable");
  unavailable = false;
  const recovered = await entitlementService.authorize({ appUserId: identity, requestId: requestId(2) });
  assert.equal(recovered.allowed, true);
});

test("validation failures release the global budget reservation without weakening request limits", async () => {
  const service = serviceFor({ globalDailyLimit: 1, subjectWindowLimit: 10, ipWindowLimit: 10 });
  const invalid = await service.authorize({ appUserId: identity, requestId: requestId(1) });
  assert.equal(invalid.allowed, true);
  await service.finalize(invalid.reservation, { countQuestion: false, countGlobal: false });
  const next = await service.authorize({ appUserId: identity, requestId: requestId(2) });
  assert.equal(next.allowed, true);
});

test("reservation finalization is idempotent and cannot over-refund shared counters", async () => {
  const service = serviceFor({ freeLimit: 2, globalDailyLimit: 2, subjectWindowLimit: 10, ipWindowLimit: 10 });
  const first = await service.authorize({ appUserId: identity, requestId: requestId(1) });
  const second = await service.authorize({ appUserId: identity, requestId: requestId(2) });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);

  assert.equal(await service.finalize(first.reservation, { countQuestion: false, countGlobal: false }), true);
  assert.equal(await service.finalize(first.reservation, { countQuestion: false, countGlobal: false }), false);

  const third = await service.authorize({ appUserId: identity, requestId: requestId(3) });
  assert.equal(third.allowed, true, "one refund should create exactly one free and global slot");
  const fourth = await service.authorize({ appUserId: identity, requestId: requestId(4) });
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.body.error.code, "daily_service_budget_reached");
});

test("successful request IDs cannot be replayed", async () => {
  const service = serviceFor();
  const first = await service.authorize({ appUserId: identity, requestId: requestId(1) });
  await service.finalize(first.reservation, { countQuestion: true });
  const replay = await service.authorize({ appUserId: identity, requestId: requestId(1) });
  assert.equal(replay.status, 409);
  assert.equal(replay.body.error.code, "duplicate_request");
});

test("forwarded addresses are trusted only behind the configured Render boundary", () => {
  const request = {
    headers: { "x-forwarded-for": "198.51.100.5, 10.0.0.1" },
    socket: { remoteAddress: "127.0.0.1" }
  };
  assert.equal(trustedClientAddress(request), "127.0.0.1");
  assert.equal(trustedClientAddress(request, { trustForwardedFor: true }), "198.51.100.5");
  request.headers["x-forwarded-for"] = "forged";
  assert.equal(trustedClientAddress(request, { trustForwardedFor: true }), "127.0.0.1");
});

test("production CORS rejects wildcard configuration and echoes only exact origins", () => {
  assert.throws(() => createCorsPolicy("*", { production: true }), /exact origins/);
  const policy = createCorsPolicy("https://kaiscout.github.io,https://example.com", { production: true });
  assert.equal(policy.allows("https://kaiscout.github.io"), true);
  assert.equal(policy.allows("https://kaiscout.github.io.evil.test"), false);
  assert.deepEqual(policy.headers("https://example.com"), {
    "Access-Control-Allow-Origin": "https://example.com",
    Vary: "Origin"
  });
});

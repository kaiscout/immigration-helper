import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_FREE_LIMIT = 10;
const DEFAULT_SUBJECT_WINDOW_LIMIT = 30;
const DEFAULT_IP_WINDOW_LIMIT = 90;
const DEFAULT_GLOBAL_DAILY_LIMIT = 2_000;
const DEFAULT_WINDOW_SECONDS = 10 * 60;
const DEFAULT_ENTITLEMENT_CACHE_SECONDS = 5 * 60;
const APP_USER_ID_PATTERN = /^[A-Za-z0-9_$:.-]{6,128}$/u;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{12,128}$/u;

const integerSetting = (value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");
const utcMonth = (date) => date.toISOString().slice(0, 7);
const utcDay = (date) => date.toISOString().slice(0, 10);

const secondsUntil = (date, target) => Math.max(60, Math.ceil((target.getTime() - date.getTime()) / 1_000));
const secondsUntilNextMonth = (date) => secondsUntil(
  date,
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
);
const secondsUntilNextDay = (date) => secondsUntil(
  date,
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1))
);

export function normalizeCasePilotAppUserId(value) {
  const normalized = String(value || "").trim();
  return APP_USER_ID_PATTERN.test(normalized) ? normalized : "";
}

export function normalizeCasePilotRequestId(value) {
  const normalized = String(value || "").trim();
  return REQUEST_ID_PATTERN.test(normalized) ? normalized : "";
}

export function casePilotPayloadForAccess(payload, { isPlus = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || isPlus) return payload;
  const { checklistContext: _restrictedChecklistContext, ...allowedPayload } = payload;
  return allowedPayload;
}

export function createMemoryAccessStore({ now = () => Date.now() } = {}) {
  const counters = new Map();
  const values = new Map();
  const finalizedReservations = new Map();

  const clearExpired = (entry) => entry && entry.expiresAt <= now();

  return {
    async consume(key, limit, ttlSeconds) {
      const current = counters.get(key);
      const count = clearExpired(current) ? 0 : Number(current?.count || 0);
      if (count >= limit) return { allowed: false, count, remaining: 0 };
      const next = count + 1;
      counters.set(key, { count: next, expiresAt: now() + ttlSeconds * 1_000 });
      return { allowed: true, count: next, remaining: Math.max(0, limit - next) };
    },
    async release(key) {
      const current = counters.get(key);
      if (!current || clearExpired(current)) {
        counters.delete(key);
        return;
      }
      current.count = Math.max(0, Number(current.count || 0) - 1);
    },
    async releaseManyOnce(reservationId, keys, ttlSeconds) {
      const existing = finalizedReservations.get(reservationId);
      if (existing && !clearExpired(existing)) return false;
      finalizedReservations.set(reservationId, { expiresAt: now() + ttlSeconds * 1_000 });
      for (const key of keys) {
        const current = counters.get(key);
        if (!current || clearExpired(current)) {
          counters.delete(key);
          continue;
        }
        current.count = Math.max(0, Number(current.count || 0) - 1);
        if (current.count === 0) counters.delete(key);
      }
      return true;
    },
    async getJson(key) {
      const current = values.get(key);
      if (!current || clearExpired(current)) {
        values.delete(key);
        return null;
      }
      return current.value;
    },
    async setJson(key, value, ttlSeconds) {
      values.set(key, { value, expiresAt: now() + ttlSeconds * 1_000 });
    },
    async close() {}
  };
}

const FILE_STORE_VERSION = 1;

const finiteExpiration = (entry) => Number.isFinite(entry?.expiresAt) && entry.expiresAt > 0;

const mapFromEntries = (entries, label, validValue) => {
  if (!Array.isArray(entries)) throw new Error(`Invalid ${label} in CasePilot access store.`);
  return new Map(entries.map((entry) => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "string" ||
      !validValue(entry[1])
    ) {
      throw new Error(`Invalid ${label} entry in CasePilot access store.`);
    }
    return entry;
  }));
};

export async function createFileAccessStore({ filePath, now = () => Date.now() } = {}) {
  const configuredPath = String(filePath || "");
  if (!configuredPath || !path.isAbsolute(configuredPath)) {
    throw new Error("An absolute file path is required for the CasePilot access store.");
  }
  const resolvedPath = path.resolve(configuredPath);

  await mkdir(path.dirname(resolvedPath), { recursive: true });

  let counters = new Map();
  let values = new Map();
  let finalizedReservations = new Map();
  try {
    const parsed = JSON.parse(await readFile(resolvedPath, "utf8"));
    if (parsed?.version !== FILE_STORE_VERSION) {
      throw new Error("Unsupported CasePilot access store version.");
    }
    counters = mapFromEntries(
      parsed.counters,
      "counter",
      (entry) => finiteExpiration(entry) && Number.isSafeInteger(entry.count) && entry.count > 0
    );
    values = mapFromEntries(
      parsed.values,
      "value",
      (entry) => finiteExpiration(entry) && Object.hasOwn(entry, "value")
    );
    finalizedReservations = mapFromEntries(
      parsed.finalizedReservations,
      "reservation",
      finiteExpiration
    );
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error("CasePilot access store could not be loaded safely.", { cause: error });
    }
  }

  let queue = Promise.resolve();
  let fatalError = null;
  let closed = false;

  const clearExpired = (entry) => entry && entry.expiresAt <= now();
  const pruneExpired = () => {
    let changed = false;
    for (const collection of [counters, values, finalizedReservations]) {
      for (const [key, entry] of collection) {
        if (clearExpired(entry)) {
          collection.delete(key);
          changed = true;
        }
      }
    }
    return changed;
  };
  const persist = async () => {
    const temporaryPath = `${resolvedPath}.${process.pid}.${randomUUID()}.tmp`;
    const payload = JSON.stringify({
      version: FILE_STORE_VERSION,
      counters: [...counters],
      values: [...values],
      finalizedReservations: [...finalizedReservations]
    });
    try {
      await writeFile(temporaryPath, payload, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, resolvedPath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => {});
      throw error;
    }
  };
  const serialized = (operation) => {
    const task = queue.then(async () => {
      if (closed) throw new Error("CasePilot access store is closed.");
      if (fatalError) throw fatalError;
      try {
        return await operation();
      } catch (error) {
        fatalError = new Error("CasePilot access store is unavailable.", { cause: error });
        throw fatalError;
      }
    });
    queue = task.catch(() => {});
    return task;
  };

  return {
    async consume(key, limit, ttlSeconds) {
      return serialized(async () => {
        pruneExpired();
        const current = counters.get(key);
        const count = Number(current?.count || 0);
        if (count >= limit) return { allowed: false, count, remaining: 0 };
        const next = count + 1;
        counters.set(key, { count: next, expiresAt: now() + ttlSeconds * 1_000 });
        await persist();
        return { allowed: true, count: next, remaining: Math.max(0, limit - next) };
      });
    },
    async release(key) {
      return serialized(async () => {
        const pruned = pruneExpired();
        const current = counters.get(key);
        if (!current) {
          if (pruned) await persist();
          return;
        }
        current.count = Math.max(0, Number(current.count || 0) - 1);
        if (current.count === 0) counters.delete(key);
        await persist();
      });
    },
    async releaseManyOnce(reservationId, keys, ttlSeconds) {
      return serialized(async () => {
        pruneExpired();
        if (finalizedReservations.has(reservationId)) return false;
        finalizedReservations.set(reservationId, { expiresAt: now() + ttlSeconds * 1_000 });
        for (const key of keys) {
          const current = counters.get(key);
          if (!current) continue;
          current.count = Math.max(0, Number(current.count || 0) - 1);
          if (current.count === 0) counters.delete(key);
        }
        await persist();
        return true;
      });
    },
    async getJson(key) {
      return serialized(async () => {
        const current = values.get(key);
        if (!current || !clearExpired(current)) return current?.value ?? null;
        values.delete(key);
        await persist();
        return null;
      });
    },
    async setJson(key, value, ttlSeconds) {
      return serialized(async () => {
        pruneExpired();
        values.set(key, { value, expiresAt: now() + ttlSeconds * 1_000 });
        await persist();
      });
    },
    async close() {
      await queue;
      closed = true;
    }
  };
}

const activeRevenueCatEntitlement = (payload, entitlementId, now) => {
  const entitlement = payload?.subscriber?.entitlements?.[entitlementId];
  if (!entitlement) return false;
  if (!entitlement.expires_date) return true;
  const expiration = Date.parse(entitlement.expires_date);
  return Number.isFinite(expiration) && expiration > now.getTime();
};

export function createRevenueCatEntitlementVerifier({
  apiKey,
  entitlementId,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8_000,
  now = () => new Date()
} = {}) {
  const key = String(apiKey || "").trim();
  const configuredEntitlement = String(entitlementId || "").trim();
  if (!key || !configuredEntitlement) return null;

  return async (appUserId) => {
    const response = await fetchImpl(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${key}`
        },
        signal: AbortSignal.timeout(timeoutMs)
      }
    );
    if (response.status === 404) return { recognized: false, isPlus: false };
    if (!response.ok) throw new Error(`RevenueCat entitlement check failed with HTTP ${response.status}.`);
    return {
      recognized: true,
      isPlus: activeRevenueCatEntitlement(await response.json(), configuredEntitlement, now())
    };
  };
}

const denied = (status, code, message, access = null) => ({
  allowed: false,
  status,
  body: {
    error: { code, message },
    ...(access ? { access } : {})
  }
});

export function createCasePilotAccessService({
  store,
  verifyEntitlement,
  freeLimit = DEFAULT_FREE_LIMIT,
  subjectWindowLimit = DEFAULT_SUBJECT_WINDOW_LIMIT,
  ipWindowLimit = DEFAULT_IP_WINDOW_LIMIT,
  globalDailyLimit = DEFAULT_GLOBAL_DAILY_LIMIT,
  windowSeconds = DEFAULT_WINDOW_SECONDS,
  entitlementCacheSeconds = DEFAULT_ENTITLEMENT_CACHE_SECONDS,
  now = () => new Date()
} = {}) {
  if (!store) throw new Error("CasePilot access store is required.");
  if (typeof verifyEntitlement !== "function") {
    throw new Error("CasePilot RevenueCat entitlement verification is required.");
  }

  const limits = {
    free: integerSetting(freeLimit, DEFAULT_FREE_LIMIT, { max: 1_000 }),
    subject: integerSetting(subjectWindowLimit, DEFAULT_SUBJECT_WINDOW_LIMIT, { max: 10_000 }),
    ip: integerSetting(ipWindowLimit, DEFAULT_IP_WINDOW_LIMIT, { max: 50_000 }),
    globalDaily: integerSetting(globalDailyLimit, DEFAULT_GLOBAL_DAILY_LIMIT, { max: 1_000_000 }),
    windowSeconds: integerSetting(windowSeconds, DEFAULT_WINDOW_SECONDS, { max: 86_400 }),
    entitlementCacheSeconds: integerSetting(entitlementCacheSeconds, DEFAULT_ENTITLEMENT_CACHE_SECONDS, { max: 3_600 })
  };

  const entitlementFor = async (appUserId, subjectHash, { refresh = false } = {}) => {
    const cacheKey = `casepilot:entitlement:${subjectHash}`;
    const cached = refresh ? null : await store.getJson(cacheKey);
    if (cached && typeof cached.isPlus === "boolean" && typeof cached.recognized === "boolean") {
      return cached;
    }
    const result = await verifyEntitlement(appUserId);
    const entitlement = typeof result === "boolean"
      ? { recognized: true, isPlus: result }
      : {
          recognized: result?.recognized === true,
          isPlus: result?.isPlus === true
        };
    await store.setJson(cacheKey, entitlement, limits.entitlementCacheSeconds);
    return entitlement;
  };

  return Object.freeze({
    configured: true,
    limits,
    async authorize({ appUserId, requestId, clientAddress = "unknown", refreshEntitlement = false } = {}) {
      const subject = normalizeCasePilotAppUserId(appUserId);
      if (!subject) {
        return denied(401, "access_identity_required", "CasePilot could not verify this app installation.");
      }
      const normalizedRequestId = normalizeCasePilotRequestId(requestId);
      if (!normalizedRequestId) {
        return denied(400, "request_id_required", "CasePilot could not verify this request.");
      }

      const current = now();
      const subjectHash = sha256(subject);
      const addressHash = sha256(clientAddress || "unknown");
      const windowBucket = Math.floor(current.getTime() / (limits.windowSeconds * 1_000));
      const requestKey = `casepilot:request:${subjectHash}:${sha256(normalizedRequestId)}`;
      const requestClaim = await store.consume(requestKey, 1, 24 * 60 * 60);
      if (!requestClaim.allowed) {
        return denied(409, "duplicate_request", "This CasePilot request was already processed.");
      }

      const releaseRequest = async () => store.release(requestKey);

      const subjectRate = await store.consume(
        `casepilot:rate:subject:${subjectHash}:${windowBucket}`,
        limits.subject,
        limits.windowSeconds + 60
      );
      if (!subjectRate.allowed) {
        await releaseRequest();
        return denied(429, "subject_rate_limited", "Too many CasePilot requests. Please wait a few minutes.");
      }

      const ipRate = await store.consume(
        `casepilot:rate:ip:${addressHash}:${windowBucket}`,
        limits.ip,
        limits.windowSeconds + 60
      );
      if (!ipRate.allowed) {
        await releaseRequest();
        return denied(429, "network_rate_limited", "Too many CasePilot requests from this network. Please wait a few minutes.");
      }

      const globalKey = `casepilot:budget:${utcDay(current)}`;
      const globalUsage = await store.consume(globalKey, limits.globalDaily, secondsUntilNextDay(current));
      if (!globalUsage.allowed) {
        await releaseRequest();
        return denied(503, "daily_service_budget_reached", "CasePilot has reached its safety limit for today. Please try again later.");
      }

      let entitlement;
      try {
        entitlement = await entitlementFor(subject, subjectHash, { refresh: refreshEntitlement === true });
      } catch {
        await Promise.all([store.release(globalKey), releaseRequest()]);
        return denied(503, "entitlement_check_unavailable", "CasePilot could not verify subscription access right now.");
      }
      if (!entitlement.recognized) {
        await Promise.all([store.release(globalKey), releaseRequest()]);
        return denied(401, "access_identity_unrecognized", "CasePilot could not verify this app installation.");
      }

      if (entitlement.isPlus) {
        return {
          allowed: true,
          isPlus: true,
          access: { isPlus: true, usage: null },
          reservation: { id: randomUUID(), globalKey, requestKey }
        };
      }

      const period = utcMonth(current);
      const freeKey = `casepilot:free:${subjectHash}:${period}`;
      const freeUsage = await store.consume(freeKey, limits.free, secondsUntilNextMonth(current));
      const access = {
        isPlus: false,
        usage: {
          period,
          limit: limits.free,
          used: freeUsage.count,
          remaining: freeUsage.remaining
        }
      };
      if (!freeUsage.allowed) {
        await Promise.all([store.release(globalKey), releaseRequest()]);
        return denied(402, "free_limit_reached", "Your free CasePilot questions for this month have been used.", access);
      }

      return {
        allowed: true,
        isPlus: false,
        access,
        reservation: { id: randomUUID(), freeKey, globalKey, requestKey }
      };
    },
    async finalize(reservation, { countQuestion = true, countGlobal = true } = {}) {
      if (!reservation?.id) return false;
      const releaseKeys = [
        !countQuestion ? reservation.freeKey : null,
        !countQuestion ? reservation.requestKey : null,
        !countGlobal ? reservation.globalKey : null
      ].filter(Boolean);
      return store.releaseManyOnce(reservation.id, releaseKeys, 24 * 60 * 60);
    },
    async close() {
      await store.close?.();
    }
  });
}

export const CASEPILOT_ACCESS_DEFAULTS = Object.freeze({
  freeLimit: DEFAULT_FREE_LIMIT,
  subjectWindowLimit: DEFAULT_SUBJECT_WINDOW_LIMIT,
  ipWindowLimit: DEFAULT_IP_WINDOW_LIMIT,
  globalDailyLimit: DEFAULT_GLOBAL_DAILY_LIMIT,
  windowSeconds: DEFAULT_WINDOW_SECONDS
});

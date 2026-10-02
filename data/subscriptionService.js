import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  checkMonthlyTrialEligibility,
  findConfiguredPlusPackage,
  hasUnexpiredCachedEntitlement,
  isPurchaseCancelled,
  purchaseConfiguredPlus,
  restoreConfiguredPlus,
  subscriptionStateFromCustomerInfo
} from "./subscriptionCore.mjs";

export { isPurchaseCancelled };

export const PLUS_ENTITLEMENT_ID =
  (process.env.EXPO_PUBLIC_PLUS_ENTITLEMENT_ID || "immigration_helper_plus").trim();
export const PLUS_MONTHLY_PRODUCT_ID =
  (process.env.EXPO_PUBLIC_PLUS_MONTHLY_PRODUCT_ID || "immigration_helper_plus_monthly").trim();
export const PLUS_YEARLY_PRODUCT_ID =
  (process.env.EXPO_PUBLIC_PLUS_YEARLY_PRODUCT_ID || "immigration_helper_plus_yearly").trim();
export const FREE_AI_QUESTION_LIMIT = Number.parseInt(
  process.env.EXPO_PUBLIC_FREE_AI_QUESTION_LIMIT || "10",
  10
);

const PLUS_STATUS_KEY = "immigrationHelperPlusStatusV1";
const AI_USAGE_KEY = "immigrationHelperAiUsageV1";
const ACCESS_IDENTITY_KEY = "immigrationHelperCasePilotIdentityV1";

const revenueCatKey = () => {
  const key = Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  return String(key || "").trim();
};

const usageMonth = () => new Date().toISOString().slice(0, 7);

const defaultSubscriptionState = {
  isPlus: false,
  isPreview: false,
  storeAvailable: false,
  configured: false,
  checkedAt: null,
  expirationDate: null,
  productIdentifier: null,
  managementUrl: null
};

async function loadCachedSubscriptionState() {
  try {
    const raw = await AsyncStorage.getItem(PLUS_STATUS_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    const sanitized = {
      ...defaultSubscriptionState,
      ...stored,
      isPlus: hasUnexpiredCachedEntitlement(stored),
      isPreview: false
    };
    return sanitized;
  } catch {
    return defaultSubscriptionState;
  }
}

async function saveSubscriptionState(next) {
  const state = {
    ...defaultSubscriptionState,
    ...next,
    isPlus: next?.isPlus === true,
    isPreview: false,
    checkedAt: new Date().toISOString()
  };
  await AsyncStorage.setItem(PLUS_STATUS_KEY, JSON.stringify(state));
  return state;
}

let purchasesModulePromise = null;
let configured = false;

async function loadPurchasesModule() {
  if (Platform.OS === "web") return null;
  if (!purchasesModulePromise) {
    purchasesModulePromise = import("react-native-purchases")
      .then((module) => module.default || module)
      .catch(() => null);
  }
  return purchasesModulePromise;
}

async function configurePurchases() {
  const apiKey = revenueCatKey();
  if (!apiKey) return null;

  const Purchases = await loadPurchasesModule();
  if (!Purchases?.configure) return null;

  if (!configured) {
    Purchases.configure({ apiKey });
    configured = true;
  }

  return Purchases;
}

export async function loadSubscriptionState() {
  const cached = await loadCachedSubscriptionState();
  try {
    return await refreshSubscriptionState();
  } catch {
    return cached;
  }
}

export async function refreshSubscriptionState() {
  const Purchases = await configurePurchases();
  if (!Purchases?.getCustomerInfo) {
    return saveSubscriptionState({
      ...(await loadCachedSubscriptionState()),
      storeAvailable: false,
      configured: Boolean(revenueCatKey())
    });
  }

  const customerInfo = await Purchases.getCustomerInfo();
  return saveSubscriptionState(
    subscriptionStateFromCustomerInfo(customerInfo, PLUS_ENTITLEMENT_ID)
  );
}

const randomAccessIdentity = () => {
  const bytes = new Uint8Array(18);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return `fallback_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

async function getFallbackAccessIdentity() {
  const stored = String(await AsyncStorage.getItem(ACCESS_IDENTITY_KEY) || "").trim();
  if (stored) return stored;
  const created = randomAccessIdentity();
  await AsyncStorage.setItem(ACCESS_IDENTITY_KEY, created);
  return created;
}

export async function getCasePilotAccessIdentity() {
  const Purchases = await configurePurchases();
  if (Purchases?.getAppUserID) {
    const appUserId = String(await Purchases.getAppUserID() || "").trim();
    if (appUserId) return appUserId;
  }

  const developmentBuild = typeof __DEV__ !== "undefined" && __DEV__;
  if (Platform.OS === "web" || developmentBuild) return getFallbackAccessIdentity();
  throw new Error("access_identity_unavailable");
}

export async function getPlusOfferings() {
  const Purchases = await configurePurchases();
  if (!Purchases?.getOfferings) {
    return { available: false, packages: [] };
  }

  const offerings = await Purchases.getOfferings();
  const packages = offerings?.current?.availablePackages || [];
  const monthlyPackage = findPlusPackage(packages, "monthly");
  const monthlyTrialEligibility = await checkMonthlyTrialEligibility(
    Purchases,
    monthlyPackage,
    PLUS_MONTHLY_PRODUCT_ID
  );
  return {
    available: Boolean(
      findPlusPackage(packages, "monthly") || findPlusPackage(packages, "yearly")
    ),
    packages,
    monthlyTrialEligibility
  };
}

export const findPlusPackage = (packages, kind) =>
  findConfiguredPlusPackage(packages, kind, {
    monthly: PLUS_MONTHLY_PRODUCT_ID,
    yearly: PLUS_YEARLY_PRODUCT_ID
  });

export async function purchasePlus(kind = "monthly") {
  const Purchases = await configurePurchases();
  if (!Purchases?.purchasePackage) {
    throw new Error("store_unavailable");
  }

  const offerings = await getPlusOfferings();
  const selected = findPlusPackage(offerings.packages, kind);

  if (!selected) throw new Error("product_unavailable");

  const state = await purchaseConfiguredPlus({
    Purchases,
    packages: offerings.packages,
    kind,
    productIds: {
      monthly: PLUS_MONTHLY_PRODUCT_ID,
      yearly: PLUS_YEARLY_PRODUCT_ID
    },
    entitlementId: PLUS_ENTITLEMENT_ID
  });
  return saveSubscriptionState(state);
}

export async function restorePlusPurchases() {
  const Purchases = await configurePurchases();
  if (!Purchases?.restorePurchases) {
    throw new Error("store_unavailable");
  }

  const state = await restoreConfiguredPlus({
    Purchases,
    entitlementId: PLUS_ENTITLEMENT_ID
  });
  return saveSubscriptionState(state);
}

export async function loadAiUsage() {
  try {
    const raw = await AsyncStorage.getItem(AI_USAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const month = usageMonth();
    return parsed.month === month
      ? {
          month,
          count: Number(parsed.count || 0),
          limit: Number(parsed.limit || FREE_AI_QUESTION_LIMIT),
          remaining: Number.isFinite(Number(parsed.remaining))
            ? Math.max(0, Number(parsed.remaining))
            : Math.max(0, FREE_AI_QUESTION_LIMIT - Number(parsed.count || 0))
        }
      : { month, count: 0, limit: FREE_AI_QUESTION_LIMIT, remaining: FREE_AI_QUESTION_LIMIT };
  } catch {
    return {
      month: usageMonth(),
      count: 0,
      limit: FREE_AI_QUESTION_LIMIT,
      remaining: FREE_AI_QUESTION_LIMIT
    };
  }
}

export async function getRemainingFreeAiQuestions() {
  const usage = await loadAiUsage();
  return Math.max(0, Number(usage.remaining));
}

export async function saveServerAiUsage(access) {
  const usage = access?.usage;
  if (!usage || typeof usage !== "object") return loadAiUsage();
  const month = String(usage.period || "");
  const limit = Math.max(1, Number(usage.limit || FREE_AI_QUESTION_LIMIT));
  const count = Math.max(0, Math.min(limit, Number(usage.used || 0)));
  const next = {
    month,
    count,
    limit,
    remaining: Math.max(0, Math.min(limit, Number(usage.remaining ?? (limit - count))))
  };
  await AsyncStorage.setItem(AI_USAGE_KEY, JSON.stringify(next));
  return next;
}

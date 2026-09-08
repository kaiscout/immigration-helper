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
export const PLUS_PREVIEW_UNLOCKED = Boolean(
  typeof __DEV__ !== "undefined" &&
  __DEV__ &&
  String(process.env.EXPO_PUBLIC_ENABLE_PLUS_PREVIEW_UNLOCK || "").trim().toLowerCase() === "true"
);

const PLUS_STATUS_KEY = "immigrationHelperPlusStatusV1";
const AI_USAGE_KEY = "immigrationHelperAiUsageV1";

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

const withPreviewUnlock = (state) => PLUS_PREVIEW_UNLOCKED
  ? {
      ...state,
      isPlus: true,
      isPreview: true,
      storeAvailable: false
    }
  : state;

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
    return withPreviewUnlock(sanitized);
  } catch {
    return withPreviewUnlock(defaultSubscriptionState);
  }
}

async function saveSubscriptionState(next) {
  const state = {
    ...defaultSubscriptionState,
    ...next,
    isPlus: next?.isPreview === true ? false : next?.isPlus === true,
    isPreview: false,
    checkedAt: new Date().toISOString()
  };
  await AsyncStorage.setItem(PLUS_STATUS_KEY, JSON.stringify(state));
  return withPreviewUnlock(state);
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
      ? { month, count: Number(parsed.count || 0) }
      : { month, count: 0 };
  } catch {
    return { month: usageMonth(), count: 0 };
  }
}

export async function getRemainingFreeAiQuestions() {
  const usage = await loadAiUsage();
  return Math.max(0, FREE_AI_QUESTION_LIMIT - usage.count);
}

export async function recordAiQuestion() {
  const current = await loadAiUsage();
  const next = {
    month: current.month,
    count: current.count + 1
  };
  await AsyncStorage.setItem(AI_USAGE_KEY, JSON.stringify(next));
  return next;
}

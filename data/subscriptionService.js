import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const PLUS_ENTITLEMENT_ID =
  (process.env.EXPO_PUBLIC_PLUS_ENTITLEMENT_ID || "immigration_helper_plus").trim();
export const PLUS_MONTHLY_PRODUCT_ID =
  (process.env.EXPO_PUBLIC_PLUS_MONTHLY_PRODUCT_ID || "immigration_helper_plus_monthly").trim();
export const PLUS_YEARLY_PRODUCT_ID =
  (process.env.EXPO_PUBLIC_PLUS_YEARLY_PRODUCT_ID || "immigration_helper_plus_yearly").trim();
export const FREE_AI_QUESTION_LIMIT = Number.parseInt(
  process.env.EXPO_PUBLIC_FREE_AI_QUESTION_LIMIT || "5",
  10
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
    return raw ? { ...defaultSubscriptionState, ...JSON.parse(raw) } : defaultSubscriptionState;
  } catch {
    return defaultSubscriptionState;
  }
}

async function saveSubscriptionState(next) {
  const state = {
    ...defaultSubscriptionState,
    ...next,
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

function stateFromCustomerInfo(customerInfo) {
  const activeEntitlement = customerInfo?.entitlements?.active?.[PLUS_ENTITLEMENT_ID];
  return {
    isPlus: Boolean(activeEntitlement),
    storeAvailable: true,
    configured: true,
    expirationDate: activeEntitlement?.expirationDate || null,
    productIdentifier: activeEntitlement?.productIdentifier || null,
    managementUrl: customerInfo?.managementURL || null
  };
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
  return saveSubscriptionState(stateFromCustomerInfo(customerInfo));
}

export async function getPlusOfferings() {
  const Purchases = await configurePurchases();
  if (!Purchases?.getOfferings) {
    return { available: false, packages: [] };
  }

  const offerings = await Purchases.getOfferings();
  return {
    available: Boolean(offerings?.current?.availablePackages?.length),
    packages: offerings?.current?.availablePackages || []
  };
}

const packageMatchesKind = (item, kind) => {
  const productId = item?.product?.identifier || "";
  const packageId = item?.identifier || "";
  const type = String(item?.packageType || "").toLowerCase();

  if (kind === "yearly") {
    return productId === PLUS_YEARLY_PRODUCT_ID ||
      packageId.toLowerCase().includes("annual") ||
      type.includes("annual");
  }

  return productId === PLUS_MONTHLY_PRODUCT_ID ||
    packageId.toLowerCase().includes("month") ||
    type.includes("month");
};

export async function purchasePlus(kind = "monthly") {
  const Purchases = await configurePurchases();
  if (!Purchases?.purchasePackage) {
    throw new Error("store_unavailable");
  }

  const offerings = await getPlusOfferings();
  const selected =
    offerings.packages.find((item) => packageMatchesKind(item, kind)) ||
    offerings.packages[0];

  if (!selected) throw new Error("store_unavailable");

  const result = await Purchases.purchasePackage(selected);
  return saveSubscriptionState(stateFromCustomerInfo(result?.customerInfo));
}

export async function restorePlusPurchases() {
  const Purchases = await configurePurchases();
  if (!Purchases?.restorePurchases) {
    throw new Error("store_unavailable");
  }

  const customerInfo = await Purchases.restorePurchases();
  return saveSubscriptionState(stateFromCustomerInfo(customerInfo));
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

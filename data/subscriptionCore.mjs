export const MONTHLY_TRIAL_ELIGIBILITY = Object.freeze({
  eligible: "eligible",
  ineligible: "ineligible",
  unknown: "unknown"
});

const REVENUECAT_INTRO_ELIGIBLE = 2;
const REVENUECAT_PURCHASE_CANCELLED = "1";

const REVENUECAT_INTRO_ELIGIBLE_NAMES = new Set([
  "INTRO_ELIGIBILITY_STATUS_ELIGIBLE",
  "ELIGIBLE"
]);
const REVENUECAT_INTRO_INELIGIBLE_NAMES = new Set([
  "INTRO_ELIGIBILITY_STATUS_INELIGIBLE",
  "INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER",
  "INELIGIBLE",
  "NO_INTRO_OFFER"
]);
const REVENUECAT_INTRO_UNKNOWN_NAMES = new Set([
  "INTRO_ELIGIBILITY_STATUS_UNKNOWN",
  "UNKNOWN"
]);

const productIdForKind = (kind, productIds) => {
  if (kind === "monthly") return String(productIds?.monthly || "").trim();
  if (kind === "yearly") return String(productIds?.yearly || "").trim();
  return "";
};

export function findConfiguredPlusPackage(packages, kind, productIds) {
  const expectedProductId = productIdForKind(kind, productIds);
  if (!expectedProductId || !Array.isArray(packages)) return null;

  return packages.find(
    (item) => item?.product?.identifier === expectedProductId
  ) || null;
}

export function hasUnexpiredCachedEntitlement(state, now = Date.now()) {
  const expirationTime = Date.parse(state?.expirationDate || "");
  return state?.isPlus === true &&
    state?.isPreview !== true &&
    Number.isFinite(expirationTime) &&
    expirationTime > now;
}

export function subscriptionStateFromCustomerInfo(customerInfo, entitlementId) {
  const activeEntitlement = customerInfo?.entitlements?.active?.[entitlementId];
  return {
    isPlus: Boolean(activeEntitlement),
    storeAvailable: true,
    configured: true,
    expirationDate: activeEntitlement?.expirationDate || null,
    productIdentifier: activeEntitlement?.productIdentifier || null,
    managementUrl: customerInfo?.managementURL || null
  };
}

export function isPurchaseCancelled(error) {
  return error?.userCancelled === true ||
    String(error?.code || "") === REVENUECAT_PURCHASE_CANCELLED;
}

export async function checkMonthlyTrialEligibility(
  Purchases,
  monthlyPackage,
  configuredMonthlyProductId
) {
  const expectedProductId = String(configuredMonthlyProductId || "").trim();
  if (
    !expectedProductId ||
    monthlyPackage?.product?.identifier !== expectedProductId ||
    typeof Purchases?.checkTrialOrIntroductoryPriceEligibility !== "function"
  ) {
    return MONTHLY_TRIAL_ELIGIBILITY.unknown;
  }

  try {
    const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([
      expectedProductId
    ]);
    const status = result?.[expectedProductId]?.status;
    if (status === REVENUECAT_INTRO_ELIGIBLE || REVENUECAT_INTRO_ELIGIBLE_NAMES.has(String(status))) {
      return MONTHLY_TRIAL_ELIGIBILITY.eligible;
    }
    if (status == null || REVENUECAT_INTRO_UNKNOWN_NAMES.has(String(status))) {
      return MONTHLY_TRIAL_ELIGIBILITY.unknown;
    }
    if (REVENUECAT_INTRO_INELIGIBLE_NAMES.has(String(status)) || status === 1 || status === 3) {
      return MONTHLY_TRIAL_ELIGIBILITY.ineligible;
    }
    return MONTHLY_TRIAL_ELIGIBILITY.unknown;
  } catch {
    return MONTHLY_TRIAL_ELIGIBILITY.unknown;
  }
}

export async function purchaseConfiguredPlus({
  Purchases,
  packages,
  kind,
  productIds,
  entitlementId
}) {
  if (typeof Purchases?.purchasePackage !== "function") {
    throw new Error("store_unavailable");
  }

  const selected = findConfiguredPlusPackage(packages, kind, productIds);
  if (!selected) throw new Error("product_unavailable");

  const result = await Purchases.purchasePackage(selected);
  return subscriptionStateFromCustomerInfo(result?.customerInfo, entitlementId);
}

export async function restoreConfiguredPlus({ Purchases, entitlementId }) {
  if (typeof Purchases?.restorePurchases !== "function") {
    throw new Error("store_unavailable");
  }

  const customerInfo = await Purchases.restorePurchases();
  return subscriptionStateFromCustomerInfo(customerInfo, entitlementId);
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  checkMonthlyTrialEligibility,
  findConfiguredPlusPackage,
  hasUnexpiredCachedEntitlement,
  isPurchaseCancelled,
  MONTHLY_TRIAL_ELIGIBILITY,
  purchaseConfiguredPlus,
  restoreConfiguredPlus,
  subscriptionStateFromCustomerInfo
} from "../data/subscriptionCore.mjs";

const productIds = {
  monthly: "immigration_helper_plus_monthly",
  yearly: "immigration_helper_plus_yearly"
};
const packages = [
  { identifier: "monthly", packageType: "MONTHLY", product: { identifier: productIds.monthly } },
  { identifier: "annual", packageType: "ANNUAL", product: { identifier: productIds.yearly } },
  { identifier: "wrong-monthly", packageType: "MONTHLY", product: { identifier: "wrong.product" } }
];

test("package selection is exact and fails closed on RevenueCat mapping drift", () => {
  assert.equal(findConfiguredPlusPackage(packages, "monthly", productIds), packages[0]);
  assert.equal(findConfiguredPlusPackage(packages, "yearly", productIds), packages[1]);
  assert.equal(
    findConfiguredPlusPackage([
      { identifier: "monthly", packageType: "MONTHLY", product: { identifier: "wrong.product" } }
    ],
    "monthly",
    productIds
    ),
    null
  );
  assert.equal(findConfiguredPlusPackage(packages, "weekly", productIds), null);
});

test("entitlement mapping and cache expiry are conservative", () => {
  const now = Date.parse("2026-09-08T12:00:00Z");
  const active = subscriptionStateFromCustomerInfo({
    managementURL: "https://apps.apple.com/account/subscriptions",
    entitlements: {
      active: {
        immigration_helper_plus: {
          expirationDate: "2026-09-09T12:00:00Z",
          productIdentifier: productIds.monthly
        }
      }
    }
  }, "immigration_helper_plus");
  assert.equal(active.isPlus, true);
  assert.equal(active.productIdentifier, productIds.monthly);
  assert.equal(hasUnexpiredCachedEntitlement({ ...active }, now), true);
  assert.equal(hasUnexpiredCachedEntitlement({ ...active, expirationDate: "2026-09-08T11:59:59Z" }, now), false);
  assert.equal(hasUnexpiredCachedEntitlement({ ...active, isPreview: true }, now), false);
  assert.equal(subscriptionStateFromCustomerInfo({ entitlements: { active: {} } }, "immigration_helper_plus").isPlus, false);
});

test("trial eligibility is eligible only on the explicit RevenueCat status", async () => {
  const eligiblePurchases = {
    checkTrialOrIntroductoryPriceEligibility: async () => ({
      [productIds.monthly]: { status: 2 }
    })
  };
  assert.equal(
    await checkMonthlyTrialEligibility(eligiblePurchases, packages[0], productIds.monthly),
    MONTHLY_TRIAL_ELIGIBILITY.eligible
  );

  for (const status of [1, 3, 0, "INTRO_ELIGIBILITY_STATUS_UNKNOWN"]) {
    const purchases = {
      checkTrialOrIntroductoryPriceEligibility: async () => ({
        [productIds.monthly]: { status }
      })
    };
    assert.equal(
      await checkMonthlyTrialEligibility(purchases, packages[0], productIds.monthly),
      status === 1 || status === 3
        ? MONTHLY_TRIAL_ELIGIBILITY.ineligible
        : MONTHLY_TRIAL_ELIGIBILITY.unknown
    );
  }
  assert.equal(
    await checkMonthlyTrialEligibility({
      checkTrialOrIntroductoryPriceEligibility: async () => { throw new Error("offline"); }
    }, packages[0], productIds.monthly),
    MONTHLY_TRIAL_ELIGIBILITY.unknown
  );
  assert.equal(
    await checkMonthlyTrialEligibility(eligiblePurchases, packages[2], productIds.monthly),
    MONTHLY_TRIAL_ELIGIBILITY.unknown
  );
});

test("purchase and restore helpers use only the selected product and propagate store outcomes", async () => {
  const customerInfo = {
    entitlements: {
      active: {
        immigration_helper_plus: {
          expirationDate: "2026-10-01T00:00:00Z",
          productIdentifier: productIds.yearly
        }
      }
    }
  };
  let purchased;
  const purchases = {
    purchasePackage: async (item) => {
      purchased = item;
      return { customerInfo };
    },
    restorePurchases: async () => customerInfo
  };
  const purchasedState = await purchaseConfiguredPlus({
    Purchases: purchases,
    packages,
    kind: "yearly",
    productIds,
    entitlementId: "immigration_helper_plus"
  });
  assert.equal(purchased, packages[1]);
  assert.equal(purchasedState.isPlus, true);
  assert.equal((await restoreConfiguredPlus({ Purchases: purchases, entitlementId: "immigration_helper_plus" })).isPlus, true);

  await assert.rejects(
    purchaseConfiguredPlus({
      Purchases: purchases,
      packages: [{ identifier: "annual", packageType: "ANNUAL", product: { identifier: "wrong" } }],
      kind: "yearly",
      productIds,
      entitlementId: "immigration_helper_plus"
    }),
    /product_unavailable/
  );
  await assert.rejects(
    purchaseConfiguredPlus({ Purchases: {}, packages, kind: "monthly", productIds, entitlementId: "immigration_helper_plus" }),
    /store_unavailable/
  );
  await assert.rejects(
    restoreConfiguredPlus({ Purchases: {}, entitlementId: "immigration_helper_plus" }),
    /store_unavailable/
  );
});

test("purchase cancellation detection distinguishes user cancellation from other failures", () => {
  assert.equal(isPurchaseCancelled({ userCancelled: true }), true);
  assert.equal(isPurchaseCancelled({ code: "1" }), true);
  assert.equal(isPurchaseCancelled({ code: "2" }), false);
  assert.equal(isPurchaseCancelled(new Error("cancelled")), false);
});

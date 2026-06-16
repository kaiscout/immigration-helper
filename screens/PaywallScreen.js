import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADII, SHADOW, SPACING, TYPE } from "../constants/theme";
import {
  getPlusOfferings,
  loadSubscriptionState,
  purchasePlus,
  restorePlusPurchases
} from "../data/subscriptionService";

const benefitIcons = [
  "chatbubble-ellipses-outline",
  "checkmark-done-outline",
  "alarm-outline",
  "shield-checkmark-outline"
];

export default function PaywallScreen({ navigation, route }) {
  const { t } = useTranslation();
  const [subscription, setSubscription] = useState(null);
  const [offerings, setOfferings] = useState({ available: false, packages: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const feature = route?.params?.feature || "";
  const benefits = useMemo(() => [
    t("plus.featureAi"),
    t("plus.featureChecklist"),
    t("plus.featureReminders"),
    t("plus.featureSources")
  ], [t]);

  const priceFor = useCallback((kind) => {
    const match = offerings.packages.find((item) => {
      const id = `${item?.identifier || ""} ${item?.product?.identifier || ""}`.toLowerCase();
      return kind === "yearly"
        ? id.includes("year") || id.includes("annual")
        : id.includes("month");
    });
    return match?.product?.priceString || t("plus.pricePending");
  }, [offerings.packages, t]);

  const planOptions = useMemo(() => [
    {
      key: "yearly",
      title: t("plus.yearly"),
      price: priceFor("yearly"),
      helper: t("plus.trial"),
      cta: t("plus.subscribeYearly"),
      featured: true
    },
    {
      key: "monthly",
      title: t("plus.monthly"),
      price: priceFor("monthly"),
      helper: "",
      cta: t("plus.subscribeMonthly"),
      featured: false
    }
  ], [priceFor, t]);

  const loadPaywall = useCallback(async () => {
    try {
      const [state, storeOfferings] = await Promise.all([
        loadSubscriptionState(),
        getPlusOfferings()
      ]);
      setSubscription(state);
      setOfferings(storeOfferings);
    } catch {
      setSubscription({ isPlus: false, storeAvailable: false });
      setOfferings({ available: false, packages: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPaywall();
  }, [loadPaywall]);

  const handlePurchase = async (kind) => {
    setBusy(kind);
    try {
      const state = await purchasePlus(kind);
      setSubscription(state);
      if (state.isPlus) {
        navigation.goBack();
      } else {
        Alert.alert(t("plus.purchaseErrorTitle"), t("plus.purchaseErrorBody"));
      }
    } catch (error) {
      if (!String(error?.message || "").includes("cancel")) {
        Alert.alert(t("plus.purchaseErrorTitle"), t("plus.purchaseErrorBody"));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    setBusy("restore");
    try {
      const state = await restorePlusPurchases();
      setSubscription(state);
      Alert.alert(
        state.isPlus ? t("plus.restoreSuccessTitle") : t("plus.restoreMissingTitle"),
        state.isPlus ? t("plus.restoreSuccessBody") : t("plus.restoreMissingBody")
      );
      if (state.isPlus) navigation.goBack();
    } catch {
      Alert.alert(t("plus.purchaseErrorTitle"), t("plus.storeUnavailableBody"));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="sparkles-outline" size={26} color={COLORS.primaryTextOn} />
          </View>
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.primaryTextOn} />
            <Text style={styles.heroBadgeText}>{t("plus.shortTitle")}</Text>
          </View>
        </View>
        <Text style={styles.title}>{t("plus.title")}</Text>
        <Text style={styles.subtitle}>
          {feature === "checklistAi" ? t("plus.checklistRequired") : t("plus.subtitle")}
        </Text>
      </View>

      <View style={styles.benefits}>
        {benefits.map((benefit, index) => (
          <View key={benefit} style={styles.benefitRow}>
            <View style={styles.benefitIcon}>
              <Ionicons name={benefitIcons[index]} size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      {subscription?.isPlus ? (
        <View style={styles.activeCard}>
          <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
          <Text style={styles.activeText}>{t("plus.statusActive")}</Text>
        </View>
      ) : null}

      {!offerings.available ? (
        <View style={styles.setupCard}>
          <Ionicons name="construct-outline" size={20} color={COLORS.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.setupTitle}>{t("plus.storeUnavailableTitle")}</Text>
            <Text style={styles.setupBody}>{t("plus.storeUnavailableBody")}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.plans}>
        {planOptions.map((plan) => (
          <View
            key={plan.key}
            style={[styles.planCard, plan.featured && styles.planCardFeatured]}
          >
            {plan.featured ? (
              <View style={styles.planBadge}>
                <Ionicons name="star" size={12} color={COLORS.gold} />
                <Text style={styles.planBadgeText}>{t("plus.trial")}</Text>
              </View>
            ) : null}

            <View style={styles.planHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <Text
                  style={styles.planMeta}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {plan.price}
                </Text>
              </View>
              <View style={[styles.planMark, plan.featured && styles.planMarkFeatured]}>
                <Ionicons
                  name={plan.featured ? "sparkles-outline" : "ellipse-outline"}
                  size={18}
                  color={plan.featured ? COLORS.primaryTextOn : COLORS.subtext}
                />
              </View>
            </View>

            {!plan.featured && plan.helper ? <Text style={styles.planTrial}>{plan.helper}</Text> : null}

            <TouchableOpacity
              style={[
                plan.featured ? styles.primaryButton : styles.secondaryButton,
                (!offerings.available || busy) && styles.disabledButton
              ]}
              onPress={() => handlePurchase(plan.key)}
              disabled={!offerings.available || Boolean(busy)}
              accessibilityRole="button"
            >
              {busy === plan.key ? (
                <ActivityIndicator color={plan.featured ? COLORS.primaryTextOn : COLORS.primary} />
              ) : (
                <Text style={plan.featured ? styles.primaryButtonText : styles.secondaryButtonText}>
                  {plan.cta}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.restoreButton}
        onPress={handleRestore}
        disabled={Boolean(busy)}
        accessibilityRole="button"
      >
        <Text style={styles.restoreText}>
          {busy === "restore" ? "..." : t("plus.restore")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.notNowButton}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
      >
        <Text style={styles.notNowText}>{t("plus.notNow")}</Text>
      </TouchableOpacity>

      <Text style={styles.legal}>{t("plus.legal")}</Text>
      <Text style={styles.legal}>{t("plus.reviewNote")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg
  },
  wrap: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  hero: {
    backgroundColor: COLORS.inkSoft,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    ...SHADOW.card
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginBottom: SPACING.md
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: RADII.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)"
  },
  heroBadgeText: { color: COLORS.primaryTextOn, fontWeight: "900", fontSize: 12 },
  title: { color: COLORS.primaryTextOn, ...TYPE.title },
  subtitle: { color: "rgba(255,255,255,0.82)", ...TYPE.body, marginTop: SPACING.sm },
  benefits: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOW.soft
  },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: 42 },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: RADII.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight
  },
  benefitText: { flex: 1, color: COLORS.text, fontWeight: "800", lineHeight: 20 },
  activeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ECFDF3",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: RADII.xl,
    padding: SPACING.md
  },
  activeText: { color: COLORS.success, fontWeight: "900" },
  setupCard: {
    flexDirection: "row",
    gap: SPACING.md,
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: RADII.xl,
    padding: SPACING.lg
  },
  setupTitle: { color: COLORS.text, fontWeight: "900" },
  setupBody: { color: COLORS.subtext, lineHeight: 20, marginTop: 4 },
  plans: { gap: SPACING.md },
  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOW.soft
  },
  planCardFeatured: {
    borderColor: "#AFC2FF",
    backgroundColor: "#FCFDFF",
    ...SHADOW.card
  },
  planBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1,
    borderColor: "#F7D58C"
  },
  planBadgeText: { color: COLORS.gold, fontWeight: "900", fontSize: 11, lineHeight: 15 },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md
  },
  planMark: {
    width: 36,
    height: 36,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.muted,
    alignItems: "center",
    justifyContent: "center"
  },
  planMarkFeatured: { backgroundColor: COLORS.primary },
  planTitle: { color: COLORS.text, fontWeight: "900", fontSize: 20, lineHeight: 25 },
  planMeta: { color: COLORS.primary, fontWeight: "900", marginTop: 5, fontSize: 16, lineHeight: 21 },
  planTrial: { color: COLORS.subtext, lineHeight: 19 },
  primaryButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.md,
    backgroundColor: COLORS.primary
  },
  primaryButtonText: { color: COLORS.primaryTextOn, fontWeight: "900", fontSize: 15 },
  secondaryButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.md,
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900", fontSize: 15 },
  disabledButton: { opacity: 0.48 },
  restoreButton: { alignItems: "center", justifyContent: "center", paddingVertical: SPACING.sm, minHeight: 44 },
  restoreText: { color: COLORS.primary, fontWeight: "900" },
  notNowButton: { alignItems: "center", justifyContent: "center", paddingVertical: SPACING.xs, minHeight: 40 },
  notNowText: { color: COLORS.subtext, fontWeight: "800" },
  legal: { color: COLORS.subtext, fontSize: 12, lineHeight: 18, textAlign: "center" }
});

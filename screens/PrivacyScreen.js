import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { PRIVACY_POINTS } from "../data/resources";
import { loadAiConsent, revokeAiConsent, updateChecklistSharing } from "../data/aiConsent";
import { OFFICIAL_LINKS } from "../constants/officialLinks";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import { openExternalLink } from "../data/externalLinks";
import {
  loadSubscriptionState,
  restorePlusPurchases
} from "../data/subscriptionService";

export default function PrivacyScreen({ navigation }) {
  const { t } = useTranslation();
  const [consent, setConsent] = useState(undefined);
  const [subscription, setSubscription] = useState({ isPlus: false });

  const loadConsent = useCallback(async () => {
    try {
      const [nextConsent, nextSubscription] = await Promise.all([
        loadAiConsent(),
        loadSubscriptionState()
      ]);
      setConsent(nextConsent);
      setSubscription(nextSubscription);
    } catch {
      Alert.alert(t("alerts.loadingErrorTitle"), t("alerts.loadingErrorBody"));
      setConsent(null);
    }
  }, [t]);

  useEffect(() => {
    loadConsent();
    const unsubscribe = navigation.addListener?.("focus", loadConsent);
    return unsubscribe;
  }, [navigation, loadConsent]);

  const changeChecklistSharing = async (value) => {
    if (value && !subscription?.isPlus) {
      navigation.navigate("Paywall", { feature: "checklistAi" });
      return;
    }

    try {
      const next = await updateChecklistSharing(value);
      setConsent(next);
    } catch {
      Alert.alert(t("alerts.saveErrorTitle"), t("alerts.saveErrorBody"));
    }
  };

  const restorePurchases = async () => {
    try {
      const next = await restorePlusPurchases();
      setSubscription(next);
      Alert.alert(
        next.isPlus ? t("plus.restoreSuccessTitle") : t("plus.restoreMissingTitle"),
        next.isPlus ? t("plus.restoreSuccessBody") : t("plus.restoreMissingBody")
      );
    } catch {
      Alert.alert(t("plus.purchaseErrorTitle"), t("plus.storeUnavailableBody"));
    }
  };

  const withdrawConsent = () => {
    Alert.alert(
      t("privacy.revokeTitle"),
      t("privacy.revokeBody"),
      [
        { text: t("privacy.cancel"), style: "cancel" },
        {
          text: t("privacy.revokeConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await revokeAiConsent();
              setConsent(null);
            } catch {
              Alert.alert(t("alerts.saveErrorTitle"), t("alerts.saveErrorBody"));
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="lock-closed-outline" size={26} color={COLORS.primaryTextOn} />
        </View>
        <Text style={styles.title}>{t("privacy.title")}</Text>
        <Text style={styles.subtitle}>{t("privacy.subtitle")}</Text>
      </View>

      {PRIVACY_POINTS.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.iconBox}>
            <Ionicons name={item.icon} size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t(item.titleKey)}</Text>
            <Text style={styles.cardBody}>{t(item.bodyKey)}</Text>
          </View>
        </View>
      ))}

      <View style={styles.plusCard}>
        <View style={styles.iconBox}>
          <Ionicons name="sparkles-outline" size={22} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{t("plus.title")}</Text>
          <Text style={styles.cardBody}>
            {subscription?.isPlus ? t("plus.statusActive") : t("plus.statusInactive")}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.plusButton}
          onPress={() => subscription?.isPlus ? restorePurchases() : navigation.navigate("Paywall")}
          accessibilityRole="button"
        >
          <Text style={styles.plusButtonText}>
            {subscription?.isPlus ? t("plus.restore") : t("plus.shortTitle")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlsHeader}>
          <View style={styles.iconBox}>
            <Ionicons name="options-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t("privacy.controlsTitle")}</Text>
            <Text style={styles.cardBody}>
              {consent ? t("privacy.consentActive") : t("privacy.consentInactive")}
            </Text>
          </View>
        </View>

        {consent ? (
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>{t("privacy.checklistConsentTitle")}</Text>
              <Text style={styles.settingBody}>{t("privacy.checklistSettingBody")}</Text>
            </View>
            <Switch
              value={subscription?.isPlus === true && consent.shareChecklist === true}
              onValueChange={changeChecklistSharing}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={subscription?.isPlus === true && consent.shareChecklist ? COLORS.primary : COLORS.subtext}
              accessibilityLabel={t("privacy.checklistConsentTitle")}
            />
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => consent ? withdrawConsent() : navigation.navigate("AIAdvisor")}
        >
          <Text style={[styles.controlButtonText, consent && styles.dangerText]}>
            {consent ? t("privacy.revokeButton") : t("privacy.reviewConsent")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.policyButton}
          onPress={() => openExternalLink(OFFICIAL_LINKS.privacy, t)}
          accessibilityRole="link"
        >
          <Ionicons name="open-outline" size={16} color={COLORS.primary} />
          <Text style={styles.policyButtonText}>{t("privacy.policyLink")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.notice}>
        <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
        <Text style={styles.noticeText}>{t("privacy.disclaimer")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  header: {
    backgroundColor: COLORS.ai,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    ...SHADOW.card
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,255,255,0.17)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md
  },
  title: { color: COLORS.primaryTextOn, fontSize: 28, lineHeight: 34, fontWeight: "900" },
  subtitle: { color: "rgba(255,255,255,0.84)", lineHeight: 21, marginTop: SPACING.sm },
  card: {
    flexDirection: "row",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  cardTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  cardBody: { color: COLORS.subtext, lineHeight: 20, marginTop: 4 },
  plusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    ...SHADOW.soft
  },
  plusButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary
  },
  plusButtonText: { color: COLORS.primaryTextOn, fontWeight: "900", fontSize: 12 },
  controls: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOW.soft
  },
  controlsHeader: { flexDirection: "row", gap: SPACING.md, alignItems: "flex-start" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  settingTitle: { color: COLORS.text, fontWeight: "900" },
  settingBody: { color: COLORS.subtext, fontSize: 12, lineHeight: 17, marginTop: 3 },
  controlButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSoft,
    paddingHorizontal: SPACING.md
  },
  controlButtonText: { color: COLORS.primary, fontWeight: "900", textAlign: "center" },
  dangerText: { color: COLORS.danger },
  policyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: SPACING.xs
  },
  policyButtonText: { color: COLORS.primary, fontWeight: "900" },
  notice: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: SPACING.sm },
  noticeText: { color: COLORS.subtext, fontSize: 12, lineHeight: 18, flex: 1 }
});

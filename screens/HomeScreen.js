import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import { OFFICIAL_LINKS } from "../constants/officialLinks";
import { openExternalLink } from "../data/externalLinks";
import eadFlow from "../data/flows/ead.json";
import tpsFlow from "../data/flows/tps_renewal.json";
import travelFlow from "../data/flows/travel_auth.json";

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();

  const processCards = [
    {
      key: "tps",
      title: t("home.tpsRenewal"),
      subtitle: t("home.tpsSubtitle"),
      icon: "shield-checkmark-outline",
      badge: t("home.guided"),
      flow: tpsFlow
    },
    {
      key: "ead",
      title: t("home.workPermit"),
      subtitle: t("home.eadSubtitle"),
      icon: "briefcase-outline",
      badge: t("home.documents"),
      flow: eadFlow
    },
    {
      key: "travel",
      title: t("home.travelDoc"),
      subtitle: t("home.travelSubtitle"),
      icon: "airplane-outline",
      badge: t("home.caution"),
      flow: travelFlow
    }
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="sparkles-outline" size={26} color={COLORS.primary} />
          </View>
          <TouchableOpacity
            style={styles.safePill}
            onPress={() => navigation.navigate("Privacy")}
            accessibilityRole="button"
            accessibilityLabel={t("privacy.title")}
          >
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.success} />
            <Text style={styles.safePillText}>{t("home.privacyFirst")}</Text>
          </TouchableOpacity>
        </View>
        <Text
          style={styles.appTitle}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {t("appTitle")}
        </Text>
        <Text style={styles.heroSubtitle}>{t("home.heroSubtitle")}</Text>
      </View>

      <TouchableOpacity
        style={styles.aiCard}
        onPress={() => navigation.navigate("AIAdvisor")}
        accessibilityRole="button"
        accessibilityLabel={t("ai.title")}
      >
        <View style={styles.aiLeft}>
          <View style={styles.aiIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.primaryTextOn} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>{t("ai.title")}</Text>
            <Text style={styles.aiSubtitle}>{t("ai.homeSubtitle")}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={22} color={COLORS.primaryTextOn} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.plusCard}
        onPress={() => navigation.navigate("Paywall")}
        accessibilityRole="button"
        accessibilityLabel={t("plus.title")}
      >
        <View style={styles.plusIcon}>
          <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.plusTitle}>{t("plus.homeTitle")}</Text>
          <Text style={styles.plusBody}>{t("plus.homeBody")}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.subtext} />
      </TouchableOpacity>

      <View style={styles.quickGrid}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate("Reminders")}
          accessibilityRole="button"
          accessibilityLabel={t("home.quickReminders")}
        >
          <Ionicons name="alarm-outline" size={22} color={COLORS.primary} />
          <Text style={styles.quickTitle}>{t("home.quickReminders")}</Text>
          <Text style={styles.quickSub}>{t("home.quickRemindersSub")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate("Resources")}
          accessibilityRole="button"
          accessibilityLabel={t("home.quickResources")}
        >
          <Ionicons name="library-outline" size={22} color={COLORS.primary} />
          <Text style={styles.quickTitle}>{t("home.quickResources")}</Text>
          <Text style={styles.quickSub}>{t("home.quickResourcesSub")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.title}>{t("home.title")}</Text>
      </View>

      {processCards.map((card) => (
        <TouchableOpacity
          key={card.key}
          style={styles.card}
          onPress={() => navigation.navigate("Flow", { flow: card.flow })}
          accessibilityRole="button"
          accessibilityLabel={card.title}
        >
          <View style={styles.cardIcon}>
            <Ionicons name={card.icon} size={24} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.badge}>{card.badge}</Text>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardSub}>{card.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.subtext} />
        </TouchableOpacity>
      ))}

      <View style={styles.disclaimerBox}>
        <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
        <Text style={styles.disclaimer}>{t("common.disclaimer")}</Text>
      </View>

      <View style={styles.bottomLinks}>
        <TouchableOpacity
          style={styles.bottomLink}
          onPress={() => navigation.navigate("Privacy")}
          accessibilityRole="button"
          accessibilityLabel={t("privacy.title")}
        >
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.subtext} />
          <Text style={styles.bottomLinkText}>{t("privacy.title")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bottomLink}
          onPress={() => openExternalLink(OFFICIAL_LINKS.scams, t)}
          accessibilityRole="link"
          accessibilityLabel={t("resources.scamsTitle")}
        >
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.subtext} />
          <Text style={styles.bottomLinkText}>{t("resources.scamsTitle")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: SPACING.lg, gap: SPACING.md, flexGrow: 1 },
  hero: {
    backgroundColor: COLORS.card,
    padding: SPACING.xl,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: SPACING.md },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: RADII.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
    marginBottom: SPACING.md
  },
  safePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADII.pill,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#BBF7D0"
  },
  safePillText: { color: COLORS.success, fontWeight: "900", fontSize: 12 },
  appTitle: { fontSize: 24, lineHeight: 30, fontWeight: "900", color: COLORS.text, letterSpacing: 0 },
  heroSubtitle: { marginTop: SPACING.sm, color: COLORS.subtext, fontSize: 15, lineHeight: 22 },
  sectionHeader: { marginTop: SPACING.sm },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: COLORS.subtext, textTransform: "uppercase", letterSpacing: 0.8 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.text, letterSpacing: 0 },
  aiCard: {
    backgroundColor: COLORS.ai,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.card
  },
  aiLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md, flex: 1 },
  aiIcon: {
    width: 46,
    height: 46,
    borderRadius: RADII.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)"
  },
  aiTitle: { color: COLORS.primaryTextOn, fontWeight: "900", fontSize: 18 },
  aiSubtitle: { color: "rgba(255,255,255,0.82)", marginTop: 3, fontSize: 13, lineHeight: 18 },
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
  plusIcon: {
    width: 42,
    height: 42,
    borderRadius: RADII.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight
  },
  plusTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  plusBody: { color: COLORS.subtext, marginTop: 4, fontSize: 12, lineHeight: 17 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  quickCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  quickTitle: { marginTop: SPACING.sm, color: COLORS.text, fontWeight: "900", lineHeight: 19 },
  quickSub: { marginTop: 4, color: COLORS.subtext, fontSize: 12, lineHeight: 17 },
  card: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    ...SHADOW.card
  },
  badge: {
    alignSelf: "flex-start",
    marginBottom: 6,
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase"
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: RADII.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight
  },
  cardTitle: { fontSize: 18, lineHeight: 23, fontWeight: "900", color: COLORS.text },
  cardSub: { marginTop: 4, color: COLORS.subtext, fontSize: 13, lineHeight: 18 },
  disclaimerBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: SPACING.md },
  disclaimer: { color: COLORS.subtext, fontSize: 12, lineHeight: 18, flex: 1 },
  bottomLinks: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: SPACING.sm },
  bottomLink: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  bottomLinkText: { color: COLORS.subtext, fontWeight: "800", fontSize: 12 }
});

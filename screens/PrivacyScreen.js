import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { PRIVACY_POINTS } from "../data/resources";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";

export default function PrivacyScreen() {
  const { t } = useTranslation();

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
  notice: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: SPACING.sm },
  noticeText: { color: COLORS.subtext, fontSize: 12, lineHeight: 18, flex: 1 }
});

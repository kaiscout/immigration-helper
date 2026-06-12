import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { OFFICIAL_RESOURCES } from "../data/resources";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import { openExternalLink } from "../data/externalLinks";

export default function ResourcesScreen({ navigation }) {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.kicker}>{t("resources.kicker")}</Text>
        <Text style={styles.title}>{t("resources.title")}</Text>
        <Text style={styles.subtitle}>{t("resources.subtitle")}</Text>
      </View>

      {OFFICIAL_RESOURCES.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.resource}
          onPress={() => openExternalLink(item.url, t)}
          accessibilityRole="link"
          accessibilityLabel={t(item.titleKey)}
        >
          <View style={styles.iconBox}>
            <Ionicons name={item.icon} size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.resourceTitle}>{t(item.titleKey)}</Text>
            <Text style={styles.resourceDesc}>{t(item.descriptionKey)}</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={COLORS.subtext} />
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={styles.privacyBtn}
        onPress={() => navigation.navigate("Privacy")}
        accessibilityRole="button"
        accessibilityLabel={t("privacy.title")}
      >
        <Ionicons name="lock-closed-outline" size={18} color={COLORS.text} />
        <Text style={styles.privacyText}>{t("privacy.title")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  header: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card
  },
  kicker: { color: COLORS.primary, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  title: { color: COLORS.text, fontSize: 28, lineHeight: 34, fontWeight: "900", marginTop: SPACING.xs },
  subtitle: { color: COLORS.subtext, lineHeight: 21, marginTop: SPACING.sm },
  resource: {
    flexDirection: "row",
    gap: SPACING.md,
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  resourceTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  resourceDesc: { color: COLORS.subtext, lineHeight: 20, marginTop: 4 },
  privacyBtn: {
    marginTop: SPACING.sm,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  privacyText: { color: COLORS.text, fontWeight: "900" }
});

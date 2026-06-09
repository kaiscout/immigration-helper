import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import LanguageDropdown from "../components/LanguageDropdown";

const ONBOARDING_KEY = "hasSeenOnboarding";

export default function OnboardingScreen({ navigation }) {
  const { t } = useTranslation();

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    navigation.replace("Home");
  };

  const points = [
    { icon: "checkmark-done-outline", title: t("onboarding.organizeTitle"), body: t("onboarding.organizeBody") },
    { icon: "alarm-outline", title: t("onboarding.remindersTitle"), body: t("onboarding.remindersBody") },
    { icon: "shield-checkmark-outline", title: t("onboarding.safetyTitle"), body: t("onboarding.safetyBody") }
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="compass-outline" size={30} color={COLORS.primaryTextOn} />
        </View>
        <Text style={styles.kicker}>{t("onboarding.kicker")}</Text>
        <Text style={styles.title}>{t("onboarding.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.subtitle")}</Text>
      </View>

      <View style={styles.langBox}>
        <LanguageDropdown compact />
      </View>

      {points.map((item) => (
        <View key={item.title} style={styles.point}>
          <View style={styles.pointIcon}>
            <Ionicons name={item.icon} size={21} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pointTitle}>{item.title}</Text>
            <Text style={styles.pointBody}>{item.body}</Text>
          </View>
        </View>
      ))}

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.warning} />
        <Text style={styles.noticeText}>{t("onboarding.notice")}</Text>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={finish}>
        <Text style={styles.primaryText}>{t("onboarding.cta")}</Text>
        <Ionicons name="arrow-forward" size={18} color={COLORS.primaryTextOn} />
      </TouchableOpacity>
    </ScrollView>
  );
}

export { ONBOARDING_KEY };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  hero: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    ...SHADOW.card
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md
  },
  kicker: { color: "rgba(255,255,255,0.72)", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  title: { color: COLORS.primaryTextOn, fontSize: 32, lineHeight: 38, fontWeight: "900", marginTop: SPACING.sm },
  subtitle: { color: "rgba(255,255,255,0.84)", lineHeight: 22, marginTop: SPACING.sm },
  langBox: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  point: {
    flexDirection: "row",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  pointIcon: {
    width: 42,
    height: 42,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  pointTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  pointBody: { color: COLORS.subtext, lineHeight: 20, marginTop: 4 },
  notice: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingHorizontal: SPACING.xs },
  noticeText: { color: COLORS.subtext, lineHeight: 20, flex: 1 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADII.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...SHADOW.card
  },
  primaryText: { color: COLORS.primaryTextOn, fontWeight: "900", fontSize: 16 }
});

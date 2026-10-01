import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import { clearCaseProfile, loadCaseProfile, saveCaseProfile } from "../data/caseProfile";
import { showAlert } from "../data/appAlert";
import { containsSensitiveIdentifier } from "../data/sensitiveIdentifiers";
import { ONBOARDING_KEY } from "./OnboardingScreen";

const EMPTY_PROFILE = Object.freeze({
  preferredName: "",
  citizenships: "",
  residenceCountry: "",
  currentSituation: "",
  immigrationGoal: ""
});

const FIELDS = Object.freeze([
  { key: "preferredName", label: "profile.nameLabel", placeholder: "profile.namePlaceholder", maxLength: 60 },
  { key: "citizenships", label: "profile.citizenshipsLabel", placeholder: "profile.citizenshipsPlaceholder", maxLength: 160 },
  { key: "residenceCountry", label: "profile.residenceLabel", placeholder: "profile.residencePlaceholder", maxLength: 120 },
  { key: "currentSituation", label: "profile.situationLabel", placeholder: "profile.situationPlaceholder", maxLength: 240 },
  { key: "immigrationGoal", label: "profile.goalLabel", placeholder: "profile.goalPlaceholder", maxLength: 240 }
]);

export default function CaseProfileScreen({ navigation, route }) {
  const { t, i18n } = useTranslation();
  const fromOnboarding = route?.params?.fromOnboarding === true;
  const isRtl = i18n.dir() === "rtl";
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadCaseProfile()
      .then((saved) => {
        if (!active) return;
        if (saved) {
          setProfile({
            preferredName: saved.preferredName,
            citizenships: saved.citizenships,
            residenceCountry: saved.residenceCountry,
            currentSituation: saved.currentSituation,
            immigrationGoal: saved.immigrationGoal
          });
          setHasSavedProfile(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const leaveProfile = async () => {
    if (fromOnboarding) {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
      return;
    }
    navigation.goBack();
  };

  const save = async () => {
    if (saving) return;
    const combined = Object.values(profile).join("\n");
    if (containsSensitiveIdentifier(combined)) {
      showAlert(t("ai.errorTitle"), t("privacy.consentSensitive"));
      return;
    }

    setSaving(true);
    try {
      await saveCaseProfile(profile);
      await leaveProfile();
    } catch {
      showAlert(t("alerts.saveErrorTitle"), t("alerts.saveErrorBody"));
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    try {
      await leaveProfile();
    } catch {
      showAlert(t("alerts.saveErrorTitle"), t("alerts.saveErrorBody"));
    }
  };

  const requestClear = () => {
    showAlert(
      t("profile.clearTitle"),
      t("profile.clearBody"),
      [
        { text: t("vault.cancel"), style: "cancel" },
        {
          text: t("profile.clearConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await clearCaseProfile();
              setProfile(EMPTY_PROFILE);
              setHasSavedProfile(false);
            } catch {
              showAlert(t("alerts.saveErrorTitle"), t("alerts.saveErrorBody"));
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.wrap}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="person-circle-outline" size={30} color={COLORS.primaryTextOn} />
          </View>
          <Text style={[styles.heroTitle, isRtl && styles.rtlText]}>{t("profile.heroTitle")}</Text>
          <Text style={[styles.heroBody, isRtl && styles.rtlText]}>{t("profile.intro")}</Text>
          <Text style={[styles.optionalNote, isRtl && styles.rtlText]}>{t("profile.optionalNote")}</Text>
        </View>

        <View style={styles.formCard}>
          {FIELDS.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={[styles.label, isRtl && styles.rtlText]}>{t(field.label)}</Text>
              <TextInput
                value={profile[field.key]}
                onChangeText={(value) => setProfile((current) => ({ ...current, [field.key]: value }))}
                placeholder={t(field.placeholder)}
                placeholderTextColor={COLORS.subtext}
                style={[styles.input, isRtl && styles.rtlInput]}
                maxLength={field.maxLength}
                autoCapitalize={field.key === "preferredName" ? "words" : "sentences"}
                textContentType={field.key === "preferredName" ? "name" : "none"}
                autoCorrect={false}
              />
            </View>
          ))}
        </View>

        <View style={styles.privacyCard}>
          <Ionicons name="phone-portrait-outline" size={21} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.privacyTitle, isRtl && styles.rtlText]}>{t("profile.localNote")}</Text>
            <Text style={[styles.privacyBody, isRtl && styles.rtlText]}>{t("profile.aiNote")}</Text>
          </View>
        </View>

        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={20} color={COLORS.warning} />
          <Text style={[styles.warningText, isRtl && styles.rtlText]}>{t("privacy.consentSensitive")}</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabled]}
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t("common.save")}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.primaryTextOn} />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.primaryTextOn} />
          )}
          <Text style={styles.primaryButtonText}>{t("common.save")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={skip}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={fromOnboarding ? t("plus.notNow") : t("vault.cancel")}
        >
          <Text style={styles.secondaryButtonText}>
            {fromOnboarding ? t("plus.notNow") : t("vault.cancel")}
          </Text>
        </TouchableOpacity>

        {hasSavedProfile ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={requestClear}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t("profile.clearConfirm")}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            <Text style={styles.clearButtonText}>{t("profile.clearConfirm")}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  wrap: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md
  },
  hero: {
    backgroundColor: COLORS.ai,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    ...SHADOW.card
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,255,255,0.17)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md
  },
  heroTitle: { color: COLORS.primaryTextOn, fontSize: 28, lineHeight: 34, fontWeight: "900" },
  heroBody: { color: "rgba(255,255,255,0.88)", lineHeight: 21, marginTop: SPACING.sm },
  optionalNote: { color: "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 18, marginTop: SPACING.sm },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOW.soft
  },
  field: { gap: 7 },
  label: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.cardSoft,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 15
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADII.xl,
    padding: SPACING.lg
  },
  privacyTitle: { color: COLORS.text, fontWeight: "900", lineHeight: 20 },
  privacyBody: { color: COLORS.subtext, fontSize: 12, lineHeight: 18, marginTop: 4 },
  warningCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: SPACING.xs },
  warningText: { flex: 1, color: COLORS.subtext, fontSize: 12, lineHeight: 18 },
  primaryButton: {
    minHeight: 52,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...SHADOW.card
  },
  primaryButtonText: { color: COLORS.primaryTextOn, fontSize: 16, fontWeight: "900" },
  secondaryButton: {
    minHeight: 48,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: { color: COLORS.text, fontWeight: "900" },
  clearButton: {
    alignSelf: "center",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: SPACING.md
  },
  clearButtonText: { color: COLORS.danger, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  rtlInput: { textAlign: "right", writingDirection: "rtl" }
});

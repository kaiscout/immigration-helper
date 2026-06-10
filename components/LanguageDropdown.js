import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import { LANGUAGES } from "../i18n/languages";
import { savePreferredLanguage } from "../data/languagePreference";

export default function LanguageDropdown({ compact = false, buttonOnly = false }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentCode = (i18n.language || "en").toLowerCase().split("-")[0];

  const currentLanguage = useMemo(
    () => LANGUAGES.find((item) => item.code === currentCode) || LANGUAGES[0],
    [currentCode]
  );

  const selectLanguage = async (code) => {
    await i18n.changeLanguage(code);
    await savePreferredLanguage(code);
    setOpen(false);
  };

  return (
    <View style={buttonOnly ? styles.buttonWrap : compact ? styles.compactWrap : styles.wrap}>
      {buttonOnly ? null : <Text style={styles.label}>{t("common.language")}</Text>}

      {buttonOnly ? (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t("common.language")}
          style={styles.languageButton}
          onPress={() => setOpen(true)}
        >
          <Ionicons name="language-outline" size={18} color={COLORS.primary} />
          <Text style={styles.languageButtonText}>{currentLanguage.shortLabel}</Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.subtext} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t("common.language")}
          style={styles.trigger}
          onPress={() => setOpen(true)}
        >
          <View style={styles.triggerLeft}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{currentLanguage.shortLabel}</Text>
            </View>
            <Text style={styles.selectedText} numberOfLines={1}>
              {t(currentLanguage.labelKey)}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color={COLORS.subtext} />
        </TouchableOpacity>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.backdrop} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.menu} onPress={() => {}}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>{t("common.language")}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.closeBtn}
                onPress={() => setOpen(false)}
              >
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.options} contentContainerStyle={styles.optionsContent}>
              {LANGUAGES.map((item) => {
                const active = currentCode === item.code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    activeOpacity={0.85}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => selectLanguage(item.code)}
                  >
                    <View style={styles.optionLeft}>
                      <View style={[styles.optionBadge, active && styles.optionBadgeActive]}>
                        <Text style={[styles.optionCode, active && styles.optionCodeActive]}>
                          {item.shortLabel}
                        </Text>
                      </View>
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>
                        {t(item.labelKey)}
                      </Text>
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACING.sm },
  compactWrap: { gap: SPACING.sm },
  buttonWrap: { alignSelf: "flex-start" },
  label: {
    color: COLORS.subtext,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  trigger: {
    minHeight: 54,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    ...SHADOW.soft
  },
  triggerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  codeBadge: {
    minWidth: 44,
    height: 34,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  codeText: { color: COLORS.primary, fontWeight: "900", fontSize: 13 },
  selectedText: { flex: 1, color: COLORS.text, fontWeight: "900", fontSize: 16 },
  languageButton: {
    minHeight: 42,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    ...SHADOW.soft
  },
  languageButtonText: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(8,17,31,0.38)",
    justifyContent: "center",
    padding: SPACING.lg
  },
  menu: {
    maxHeight: "78%",
    borderRadius: RADII.xl,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOW.card
  },
  menuHeader: {
    minHeight: 58,
    paddingHorizontal: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  menuTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: RADII.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.muted
  },
  options: { maxHeight: 520 },
  optionsContent: { padding: SPACING.sm },
  option: {
    minHeight: 56,
    borderRadius: RADII.lg,
    paddingVertical: 9,
    paddingHorizontal: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm
  },
  optionActive: { backgroundColor: COLORS.primaryLight },
  optionLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  optionBadge: {
    minWidth: 42,
    height: 34,
    borderRadius: RADII.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.muted,
    paddingHorizontal: 9
  },
  optionBadgeActive: { backgroundColor: COLORS.primary },
  optionCode: { color: COLORS.subtext, fontWeight: "900", fontSize: 13 },
  optionCodeActive: { color: COLORS.primaryTextOn },
  optionText: { flex: 1, color: COLORS.text, fontWeight: "800", fontSize: 16 },
  optionTextActive: { color: COLORS.primary }
});

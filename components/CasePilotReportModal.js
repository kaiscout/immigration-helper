import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import { showAlert } from "../data/appAlert";
import {
  CASEPILOT_REPORT_CATEGORIES,
  CASEPILOT_REPORT_NOTE_LIMIT,
  casePilotReportEmail,
  createCasePilotReportId,
  prepareCasePilotReport
} from "../data/casePilotReportCore.mjs";
import {
  CASEPILOT_REPORT_EMAIL,
  composeCasePilotReportEmail
} from "../data/casePilotReport";
import {
  containsSensitiveIdentifier,
  KNOWN_PUBLIC_AGENCY_EMAILS,
  redactAllowedEmailAddressesForPrivacyScan
} from "../data/sensitiveIdentifiers";

const emailLabels = Object.freeze({
  heading: "CasePilot response report",
  reportId: "Report ID",
  category: "Category",
  language: "App language",
  appVersion: "App version",
  backendVersion: "CasePilot service version",
  response: "Selected CasePilot response excerpt:",
  note: "Optional user note:",
  privacyFooter:
    "The user chose this single response excerpt. Immigration Helper did not attach their prompt, " +
    "conversation history, Case Profile, checklist, or File Vault."
});

const reportStatusKey = ({ channel, status }) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "sent") return "casePilotReport.resultSent";
  if (normalized === "saved") return "casePilotReport.resultSaved";
  if (normalized === "cancelled") return "casePilotReport.resultCancelled";
  if (normalized === "opened" && channel === "mailto") return "casePilotReport.resultOpened";
  if (normalized === "unavailable") return "casePilotReport.resultUnavailable";
  return "casePilotReport.resultUnknown";
};

export default function CasePilotReportModal({
  visible,
  responseText,
  backendVersion,
  language,
  onClose
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState("inaccurate");
  const [note, setNote] = useState("");
  const [reportId] = useState(createCasePilotReportId());
  const [sending, setSending] = useState(false);

  const categoryLabel = t(`casePilotReport.categories.${category}`);
  const report = useMemo(() => {
    if (!visible || !String(responseText || "").trim()) return null;
    return prepareCasePilotReport({
      reportId,
      category,
      categoryLabel,
      responseText,
      note,
      language,
      appVersion: Constants.expoConfig?.version,
      backendVersion
    });
  }, [backendVersion, category, categoryLabel, language, note, reportId, responseText, visible]);
  const email = useMemo(
    () => report ? casePilotReportEmail({ report, labels: emailLabels }) : { subject: "", body: "" },
    [report]
  );

  const close = () => {
    if (!sending) onClose?.();
  };

  const send = async () => {
    if (!report) return;
    const privacyScan = redactAllowedEmailAddressesForPrivacyScan(
      `${report.responseExcerpt}\n${report.note}`,
      KNOWN_PUBLIC_AGENCY_EMAILS
    );
    if (containsSensitiveIdentifier(privacyScan)) {
      showAlert(t("casePilotReport.sensitiveTitle"), t("casePilotReport.sensitiveBody"));
      return;
    }

    setSending(true);
    try {
      const result = await composeCasePilotReportEmail(email);
      const key = reportStatusKey(result);
      showAlert(t("casePilotReport.statusTitle"), t(key, { email: CASEPILOT_REPORT_EMAIL }));
      if (["sent", "saved", "opened"].includes(String(result.status || "").toLowerCase())) {
        onClose?.();
      }
    } catch {
      showAlert(
        t("casePilotReport.statusTitle"),
        t("casePilotReport.resultFailed", { email: CASEPILOT_REPORT_EMAIL })
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("casePilotReport.title")}</Text>
            <Text style={styles.intro}>{t("casePilotReport.intro")}</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={close}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t("privacy.cancel")}
          >
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>{t("casePilotReport.categoryLabel")}</Text>
          <View style={styles.categories}>
            {CASEPILOT_REPORT_CATEGORIES.map((item) => {
              const selected = item === category;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.category, selected && styles.categorySelected]}
                  onPress={() => setCategory(item)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={t(`casePilotReport.categories.${item}`)}
                >
                  <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                    {t(`casePilotReport.categories.${item}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>{t("casePilotReport.noteLabel")}</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t("casePilotReport.notePlaceholder")}
            placeholderTextColor={COLORS.subtext}
            style={styles.note}
            multiline
            maxLength={CASEPILOT_REPORT_NOTE_LIMIT}
            textAlignVertical="top"
            accessibilityLabel={t("casePilotReport.noteLabel")}
          />
          <Text style={styles.counter}>{note.length}/{CASEPILOT_REPORT_NOTE_LIMIT}</Text>

          <View style={styles.privacyCard}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
            <Text style={styles.privacyText}>{t("casePilotReport.privacyNote")}</Text>
          </View>

          <Text style={styles.label}>{t("casePilotReport.previewLabel")}</Text>
          <View style={styles.preview}>
            <Text selectable style={styles.previewSubject}>{email.subject}</Text>
            <Text selectable style={styles.previewBody}>{email.body}</Text>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={close}
            disabled={sending}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{t("privacy.cancel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.disabled]}
            onPress={send}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t("casePilotReport.confirm")}
          >
            <Ionicons name="mail-outline" size={18} color={COLORS.primaryTextOn} />
            <Text style={styles.sendText}>{t("casePilotReport.confirm")}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card
  },
  headerText: { flex: 1 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  intro: { color: COLORS.subtext, lineHeight: 20, marginTop: 5 },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: RADII.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.muted
  },
  content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xl },
  label: { color: COLORS.text, fontWeight: "900", marginTop: SPACING.sm },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  category: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card
  },
  categorySelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  categoryText: { color: COLORS.subtext, fontWeight: "800", fontSize: 13 },
  categoryTextSelected: { color: COLORS.primary },
  note: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: SPACING.md,
    color: COLORS.text,
    backgroundColor: COLORS.card,
    fontSize: 15,
    lineHeight: 21
  },
  counter: { color: COLORS.subtext, textAlign: "right", fontSize: 12 },
  privacyCard: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "flex-start",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADII.lg,
    padding: SPACING.md
  },
  privacyText: { color: COLORS.text, flex: 1, lineHeight: 19, fontSize: 13 },
  preview: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.card
  },
  previewSubject: { color: COLORS.text, fontWeight: "900", marginBottom: SPACING.sm },
  previewBody: { color: COLORS.subtext, lineHeight: 19, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12 },
  actions: {
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
    ...SHADOW.soft
  },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: RADII.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border
  },
  cancelText: { color: COLORS.text, fontWeight: "900" },
  sendButton: {
    flex: 2,
    minHeight: 50,
    borderRadius: RADII.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    backgroundColor: COLORS.primary
  },
  sendText: { color: COLORS.primaryTextOn, fontWeight: "900" },
  disabled: { opacity: 0.55 }
});

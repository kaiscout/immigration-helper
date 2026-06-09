import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import {
  computeDueDate,
  computeKeyDates,
  loadFlowState,
  pickLocalized,
  saveFlowState
} from "../data/flowState";

export default function FlowScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const flow = route.params?.flow;
  const [noticeDate, setNoticeDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [done, setDone] = useState({});

  const lang = (i18n?.language || "en").toLowerCase();

  const pick = useCallback((obj, base) => {
    return pickLocalized(obj, base, lang);
  }, [lang]);

  useEffect(() => {
    (async () => {
      const parsed = await loadFlowState(flow);
      setNoticeDate(parsed.noticeDate || "");
      setDueDate(parsed.dueDate || "");
      setDone(parsed.done || {});
    })();
  }, [flow]);

  const saveState = async (obj) => {
    await saveFlowState(flow, obj);
  };

  const computeDue = () => {
    if (!noticeDate) {
      Alert.alert(t("alerts.enterDateTitle"), t("alerts.enterDateBody"));
      return;
    }

    const base = new Date(noticeDate);
    if (isNaN(base.getTime())) {
      Alert.alert(t("alerts.invalidDateTitle"), t("alerts.invalidDateBody"));
      return;
    }

    const iso = computeDueDate(flow, noticeDate);
    setDueDate(iso);
    saveState({ noticeDate, dueDate: iso, done });
  };

  const toggleStep = (id) => {
    const newState = { ...done, [id]: !done[id] };
    setDone(newState);
    saveState({ noticeDate, dueDate, done: newState });
  };

  const ensureNotificationPermission = async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    const requested = await Notifications.requestPermissionsAsync();
    if (!requested.granted) {
      Alert.alert(t("reminders.permissionTitle"), t("reminders.permissionBody"));
      return false;
    }

    return true;
  };

  const setReminder = async (daysBefore = 0) => {
    if (Platform.OS === "web") {
      Alert.alert(t("alerts.webReminderTitle"), t("alerts.webReminderBody"));
      return;
    }

    const allowed = await ensureNotificationPermission();
    if (!allowed) return;

    if (!dueDate) {
      Alert.alert(t("alerts.noDateTitle"), t("alerts.noDateBody"));
      return;
    }

    const [y, m, d] = dueDate.split("-").map((n) => parseInt(n, 10));
    const fire = new Date(y, m - 1, d, 9, 0, 0);
    fire.setDate(fire.getDate() - daysBefore);

    if (fire.getTime() <= Date.now()) {
      Alert.alert(t("alerts.pastDateTitle"), t("alerts.pastDateBody"));
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: t("notifications.mailingTitle"),
        body: daysBefore ? `${t("notifications.beforeDue")} ${dueDate}` : dueDate
      },
      trigger: { type: "date", date: fire }
    });

    Alert.alert("✅", `${t("notifications.reminderSet")} ${fire.toString()}`);
  };

  const clearReminder = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    Alert.alert(t("notifications.clearedTitle"), t("notifications.clearedBody"));
  };

  const calcItems = useMemo(() => {
    return computeKeyDates(flow, noticeDate, lang).map((item) => ({
      ...item,
      label: item.id === "computed_due" ? t("flow.computedDue") : item.label
    }));
  }, [noticeDate, flow, lang, t]);

  if (!flow) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.h1}>Missing flow</Text>
      </View>
    );
  }

  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  const completedCount = steps.filter((step) => done[step.id]).length;
  const progress = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;
  const officialLinks = Array.isArray(flow.resources) ? flow.resources : [];
  const reminderOptions = [
    { days: 30, label: t("flow.reminder30") },
    { days: 7, label: t("flow.reminder7") },
    { days: 0, label: t("flow.reminderDue") }
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <View style={styles.headerCard}>
        <Text style={styles.kicker}>{t("flow.process")}</Text>
        <Text style={styles.h1}>{i18n.t(flow.titleKey)}</Text>
        <Text style={styles.headerSub}>{t("flow.processSubtitle")}</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {completedCount}/{steps.length} {t("flow.completed")}
        </Text>
      </View>

      <View style={styles.trustBox}>
        <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.trustTitle}>{t("flow.verifyTitle")}</Text>
          <Text style={styles.trustText}>{t("flow.verifyBody")}</Text>
        </View>
        <TouchableOpacity style={styles.trustBtn} onPress={() => navigation.navigate("Resources")}>
          <Text style={styles.trustBtnText}>{t("resources.title")}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>{t("flow.anchorDateLabel")} (YYYY-MM-DD)</Text>
      <TextInput
        placeholder="2025-10-01"
        placeholderTextColor={COLORS.subtext}
        value={noticeDate}
        onChangeText={setNoticeDate}
        style={styles.input}
      />

      <TouchableOpacity style={styles.btn} onPress={computeDue}>
        <Ionicons name="calculator-outline" size={19} color={COLORS.primaryTextOn} />
        <Text style={styles.btnText}>{t("common.save")}</Text>
      </TouchableOpacity>

      {dueDate ? (
        <View style={styles.resultCard}>
          <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.resultLabel}>{t("flow.computedDue")}</Text>
            <Text style={styles.resultDate}>{dueDate}</Text>
          </View>
        </View>
      ) : null}

      {dueDate ? (
        <View style={styles.reminderBox}>
          <Text style={styles.h2}>{t("flow.reminderTitle")}</Text>
          <Text style={styles.helperText}>{t("flow.reminderBody")}</Text>
          <View style={styles.actionRow}>
            {reminderOptions.map((item) => (
              <TouchableOpacity key={item.days} style={styles.smallBtn} onPress={() => setReminder(item.days)}>
                <Ionicons name="notifications-outline" size={18} color={COLORS.text} />
                <Text style={styles.linkText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.smallBtn} onPress={clearReminder}>
          <Ionicons name="trash-outline" size={18} color={COLORS.text} />
          <Text style={styles.linkText}>{t("common.clearReminder")}</Text>
        </TouchableOpacity>
      </View>

      {(noticeDate || dueDate) && (
        <View style={styles.box}>
          <Text style={styles.h2}>{t("flow.keyDatesTitle")}</Text>

          {noticeDate ? (
            <View style={styles.dateLine}>
              <Text style={styles.dateLabel}>{t("flow.anchorDateLabel")}</Text>
              <Text style={styles.dateValue}>{noticeDate}</Text>
            </View>
          ) : null}

          {calcItems.map((item, idx) => (
            <View key={`date-${item.id || idx}-${idx}`} style={styles.dateLine}>
              <Text style={styles.dateLabel}>{item.label}</Text>
              <Text style={styles.dateValue}>{item.iso}</Text>
            </View>
          ))}
        </View>
      )}

      {Array.isArray(flow.forms) && flow.forms.length > 0 && (
        <View style={styles.box}>
          <Text style={styles.h2}>{t("flow.formsTitle")}</Text>

          {flow.forms.map((f, idx) => {
            const label = pick(f, "title");
            return (
              <TouchableOpacity
                key={`form-${f.id || f.url || idx}-${idx}`}
                style={styles.linkBtn}
                onPress={() => Linking.openURL(f.url)}
              >
                <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                <Text style={styles.stepTitle}>{label}</Text>
                <Ionicons name="open-outline" size={17} color={COLORS.subtext} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {officialLinks.length > 0 && (
        <View style={styles.box}>
          <Text style={styles.h2}>{t("flow.officialLinksTitle")}</Text>
          {officialLinks.map((item, idx) => (
            <TouchableOpacity
              key={`resource-${item.url || item.id || idx}-${idx}`}
              style={styles.linkBtn}
              onPress={() => Linking.openURL(item.url)}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
              <Text style={styles.stepTitle}>{pick(item, "label")}</Text>
              <Ionicons name="open-outline" size={17} color={COLORS.subtext} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.stepsHeader}>
        <Text style={styles.stepsHeading}>{t("flow.stepsTitle")}</Text>
        <Text style={styles.stepsMeta}>
          {completedCount}/{steps.length} {t("flow.completed")}
        </Text>
      </View>

      {steps.map((step, idx) => {
        const title = pick(step, "title");
        const details = pick(step, "details");
        const doneFlag = !!done[step.id];

        return (
          <TouchableOpacity
            key={`step-${step.id || idx}-${idx}`}
            style={[styles.step, doneFlag && styles.stepDone]}
            onPress={() => toggleStep(step.id)}
          >
            <View style={[styles.checkBox, doneFlag && styles.checkBoxDone]}>
              <Ionicons
                name={doneFlag ? "checkmark" : "square-outline"}
                size={doneFlag ? 18 : 20}
                color={doneFlag ? COLORS.primaryTextOn : COLORS.subtext}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepDetails}>{details}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.disclaimerBox}>
        <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
        <Text style={styles.disclaimer}>{t("common.disclaimer")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  emptyWrap: { flex: 1, padding: SPACING.xl, backgroundColor: COLORS.bg },
  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    ...SHADOW.card
  },
  kicker: { color: COLORS.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  h1: { fontSize: 30, fontWeight: "900", color: COLORS.text, marginTop: SPACING.xs, letterSpacing: -0.8 },
  headerSub: { color: COLORS.subtext, marginTop: SPACING.sm, lineHeight: 20 },
  h2: { fontSize: 20, fontWeight: "900", color: COLORS.text, marginBottom: SPACING.md },
  progressTrack: {
    height: 10,
    backgroundColor: COLORS.muted,
    borderRadius: RADII.pill,
    overflow: "hidden",
    marginTop: SPACING.lg
  },
  progressFill: { height: 10, backgroundColor: COLORS.primary, borderRadius: RADII.pill },
  progressText: { color: COLORS.subtext, fontWeight: "700", marginTop: SPACING.sm },
  trustBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    ...SHADOW.soft
  },
  trustTitle: { color: COLORS.text, fontWeight: "900" },
  trustText: { color: COLORS.subtext, fontSize: 12, lineHeight: 17, marginTop: 3 },
  trustBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADII.pill,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  trustBtnText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  label: { marginTop: SPACING.sm, marginBottom: SPACING.xs, color: COLORS.subtext, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    color: COLORS.text,
    fontSize: 16,
    ...SHADOW.soft
  },
  btn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADII.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...SHADOW.card
  },
  btnText: { color: COLORS.primaryTextOn, fontWeight: "900", letterSpacing: 0.2 },
  resultCard: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: SPACING.md,
    alignItems: "center",
    ...SHADOW.soft
  },
  resultLabel: { color: COLORS.subtext, fontWeight: "700" },
  resultDate: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 12, marginTop: SPACING.md, flexWrap: "wrap" },
  reminderBox: {
    backgroundColor: COLORS.cardSoft,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.lg
  },
  helperText: { color: COLORS.subtext, lineHeight: 20 },
  box: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card
  },
  dateLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  dateLabel: { color: COLORS.subtext, flex: 1 },
  dateValue: { color: COLORS.text, fontWeight: "900" },
  smallBtn: {
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    ...SHADOW.soft
  },
  linkBtn: {
    backgroundColor: COLORS.muted,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADII.lg,
    marginTop: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm
  },
  linkText: { color: COLORS.text, fontWeight: "900" },
  stepsHeader: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xl,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.md
  },
  stepsHeading: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center"
  },
  stepsMeta: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center"
  },
  step: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.xl,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    flexDirection: "row",
    gap: SPACING.md,
    ...SHADOW.soft
  },
  stepDone: { opacity: 0.7 },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: RADII.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.muted
  },
  checkBoxDone: { backgroundColor: COLORS.success },
  stepTitle: { fontWeight: "900", color: COLORS.text, flex: 1 },
  stepDetails: { marginTop: 6, color: COLORS.subtext, lineHeight: 20 },
  disclaimerBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: SPACING.xl },
  disclaimer: { fontSize: 12, color: COLORS.subtext, lineHeight: 18, flex: 1 }
});

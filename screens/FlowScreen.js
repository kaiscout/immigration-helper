import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import {
  computeDueDate,
  computeKeyDates,
  loadFlowState,
  pickLocalized,
  saveFlowState
} from "../data/flowState";
import { createNotificationTrigger, loadNotificationsAsync } from "../data/notificationService";
import { openExternalLink } from "../data/externalLinks";

const pad2 = (value) => String(value).padStart(2, "0");

const datePartsFromIso = (iso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return {
    year: match?.[1] || "",
    month: match?.[2] || "",
    day: match?.[3] || ""
  };
};

const daysInMonth = (year, month) => {
  const y = Number(year || new Date().getFullYear());
  const m = Number(month || 1);
  return new Date(y, m, 0).getDate();
};

const yearOptions = () => {
  const current = new Date().getFullYear();
  return Array.from({ length: 21 }, (_, idx) => String(current + 10 - idx));
};

export default function FlowScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const flow = route.params?.flow;
  const [noticeDate, setNoticeDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [done, setDone] = useState({});
  const [picker, setPicker] = useState(null);
  const [noticeDraft, setNoticeDraft] = useState({ year: "", month: "", day: "" });

  const lang = (i18n?.language || "en").toLowerCase();
  const noticeParts = noticeDraft;
  const selectedDateComplete = Boolean(noticeParts.year && noticeParts.month && noticeParts.day);
  const selectedDateText = selectedDateComplete ? noticeDate : "YYYY-MM-DD";

  const pick = useCallback((obj, base) => {
    return pickLocalized(obj, base, lang);
  }, [lang]);

  const monthOptions = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(lang || "en", { month: "short" });
    return Array.from({ length: 12 }, (_, idx) => {
      const value = pad2(idx + 1);
      return {
        value,
        label: formatter.format(new Date(2026, idx, 1))
      };
    });
  }, [lang]);

  const dayOptions = useMemo(() => {
    const count = daysInMonth(noticeParts.year, noticeParts.month);
    return Array.from({ length: count }, (_, idx) => {
      const value = pad2(idx + 1);
      return { value, label: value };
    });
  }, [noticeParts.year, noticeParts.month]);

  const years = useMemo(() => {
    const values = yearOptions();
    return noticeParts.year && !values.includes(noticeParts.year) ? [noticeParts.year, ...values] : values;
  }, [noticeParts.year]);

  const updateNoticePart = (part, value) => {
    const next = { ...noticeParts, [part]: value };

    if (part === "month" || part === "year") {
      const maxDay = daysInMonth(next.year, next.month);
      if (next.day && Number(next.day) > maxDay) {
        next.day = pad2(maxDay);
      }
    }

    if (next.year && next.month && next.day) {
      setNoticeDraft(next);
      setNoticeDate(`${next.year}-${next.month}-${next.day}`);
      return;
    }

    setNoticeDraft(next);
    setNoticeDate("");
  };

  const openPicker = (type, title, options) => {
    setPicker({ type, title, options });
  };

  const selectPickerValue = (value) => {
    if (!picker) return;
    updateNoticePart(picker.type, value);
    setPicker(null);
  };

  useEffect(() => {
    (async () => {
      try {
        const parsed = await loadFlowState(flow);
        setNoticeDate(parsed.noticeDate || "");
        setNoticeDraft(datePartsFromIso(parsed.noticeDate || ""));
        setDueDate(parsed.dueDate || "");
        setDone(parsed.done || {});
      } catch {
        Alert.alert(t("alerts.loadingErrorTitle"), t("alerts.loadingErrorBody"));
      }
    })();
  }, [flow, t]);

  const saveState = async (obj) => {
    await saveFlowState(flow, obj);
  };

  const computeDue = async () => {
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
    try {
      await saveState({ noticeDate, dueDate: iso, done });
      setDueDate(iso);
    } catch {
      Alert.alert(t("alerts.saveErrorTitle"), t("alerts.saveErrorBody"));
    }
  };

  const toggleStep = async (id) => {
    const newState = { ...done, [id]: !done[id] };
    try {
      await saveState({ noticeDate, dueDate, done: newState });
      setDone(newState);
    } catch {
      Alert.alert(t("alerts.saveErrorTitle"), t("alerts.saveErrorBody"));
    }
  };

  const ensureNotificationPermission = async () => {
    try {
      const { environment, Notifications } = await loadNotificationsAsync();

      if (environment === "web") {
        Alert.alert(t("alerts.webReminderTitle"), t("alerts.webReminderBody"));
        return null;
      }

      if (environment === "expoGo") {
        Alert.alert(t("alerts.expoGoNotificationsTitle"), t("alerts.expoGoNotificationsBody"));
        return null;
      }

      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return Notifications;

      const requested = await Notifications.requestPermissionsAsync();
      if (!requested.granted) {
        Alert.alert(t("reminders.permissionTitle"), t("reminders.permissionBody"));
        return null;
      }

      return Notifications;
    } catch {
      Alert.alert(t("alerts.reminderErrorTitle"), t("alerts.reminderErrorBody"));
      return null;
    }
  };

  const setReminder = async (daysBefore = 0) => {
    const Notifications = await ensureNotificationPermission();
    if (!Notifications) return;

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

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t("notifications.mailingTitle"),
          body: daysBefore ? `${t("notifications.beforeDue")} ${dueDate}` : dueDate,
          sound: "default"
        },
        trigger: createNotificationTrigger({ type: "date", date: fire })
      });

      Alert.alert(
        t("reminders.scheduledTitle"),
        `${t("notifications.reminderSet")} ${fire.toLocaleString(lang)}`
      );
    } catch {
      Alert.alert(t("alerts.reminderErrorTitle"), t("alerts.reminderErrorBody"));
    }
  };

  const clearReminder = async () => {
    try {
      const { environment, Notifications } = await loadNotificationsAsync();

      if (environment === "web") {
        Alert.alert(t("alerts.webReminderTitle"), t("alerts.webReminderBody"));
        return;
      }

      if (environment === "expoGo") {
        Alert.alert(t("alerts.expoGoNotificationsTitle"), t("alerts.expoGoNotificationsBody"));
        return;
      }

      await Notifications.cancelAllScheduledNotificationsAsync();
      Alert.alert(t("notifications.clearedTitle"), t("notifications.clearedBody"));
    } catch {
      Alert.alert(t("alerts.reminderErrorTitle"), t("alerts.reminderErrorBody"));
    }
  };

  const calcItems = useMemo(() => {
    return computeKeyDates(flow, noticeDate).map((item) => ({
      ...item,
      label: t(item.labelKey)
    }));
  }, [noticeDate, flow, t]);

  if (!flow) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.h1}>{t("alerts.loadingErrorTitle")}</Text>
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

      <View style={styles.datePlanner}>
        <View style={styles.datePlannerHeader}>
          <View style={styles.dateIcon}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.datePlannerTitle}>{t("flow.anchorDateLabel")}</Text>
            <Text style={styles.datePlannerHelp}>{t("flow.datePickerHint")}</Text>
          </View>
        </View>

        <View style={styles.dateSelectRow}>
          <TouchableOpacity
            style={styles.dateSelect}
            onPress={() => openPicker("month", t("flow.month"), monthOptions)}
            accessibilityRole="button"
            accessibilityLabel={t("flow.month")}
          >
            <Text style={styles.dateSelectLabel}>{t("flow.month")}</Text>
            <View style={styles.dateSelectValueRow}>
              <Text style={[styles.dateSelectValue, !noticeParts.month && styles.dateSelectPlaceholder]}>
                {monthOptions.find((item) => item.value === noticeParts.month)?.label || "--"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.subtext} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateSelect}
            onPress={() => openPicker("day", t("flow.day"), dayOptions)}
            accessibilityRole="button"
            accessibilityLabel={t("flow.day")}
          >
            <Text style={styles.dateSelectLabel}>{t("flow.day")}</Text>
            <View style={styles.dateSelectValueRow}>
              <Text style={[styles.dateSelectValue, !noticeParts.day && styles.dateSelectPlaceholder]}>
                {noticeParts.day || "--"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.subtext} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateSelect}
            onPress={() => openPicker("year", t("flow.year"), years.map((value) => ({ value, label: value })))}
            accessibilityRole="button"
            accessibilityLabel={t("flow.year")}
          >
            <Text style={styles.dateSelectLabel}>{t("flow.year")}</Text>
            <View style={styles.dateSelectValueRow}>
              <Text style={[styles.dateSelectValue, !noticeParts.year && styles.dateSelectPlaceholder]}>
                {noticeParts.year || "--"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.subtext} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.selectedDatePill}>
          <Text style={styles.selectedDateLabel}>{t("flow.selectedDate")}</Text>
          <Text style={styles.selectedDateValue}>{selectedDateText}</Text>
        </View>

        <View style={styles.dateSafetyNote}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.warning} />
          <Text style={styles.dateSafetyText}>{t("flow.dateSafetyNote")}</Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={computeDue}>
          <Ionicons name="checkmark-circle-outline" size={19} color={COLORS.primaryTextOn} />
          <Text style={styles.btnText}>{t("common.save")}</Text>
        </TouchableOpacity>
      </View>

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
        <View style={styles.timelineBox}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineTitle}>{t("flow.keyDatesTitle")}</Text>
            <View style={styles.timelineBadge}>
              <Ionicons name="sparkles-outline" size={14} color={COLORS.primary} />
              <Text style={styles.timelineBadgeText}>{t("flow.suggestedDates")}</Text>
            </View>
          </View>

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
                onPress={() => openExternalLink(f.url, t)}
                accessibilityRole="link"
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
              onPress={() => openExternalLink(item.url, t)}
              accessibilityRole="link"
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
            accessibilityRole="checkbox"
            accessibilityState={{ checked: doneFlag }}
            accessibilityLabel={title}
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

      <Modal
        visible={Boolean(picker)}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setPicker(null)} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{picker?.title}</Text>
              <TouchableOpacity
                style={styles.pickerClose}
                onPress={() => setPicker(null)}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
              >
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListContent}>
              {picker?.options.map((item) => (
                <TouchableOpacity
                  key={`${picker.type}-${item.value}`}
                  style={styles.pickerOption}
                  onPress={() => selectPickerValue(item.value)}
                >
                  <Text style={styles.pickerOptionText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  h1: { fontSize: 30, fontWeight: "900", color: COLORS.text, marginTop: SPACING.xs, letterSpacing: 0 },
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
  datePlanner: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card
  },
  datePlannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md
  },
  dateIcon: {
    width: 46,
    height: 46,
    borderRadius: RADII.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight
  },
  datePlannerTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  datePlannerHelp: { color: COLORS.subtext, lineHeight: 19, marginTop: 3 },
  dateSelectRow: {
    flexDirection: "row",
    gap: SPACING.sm
  },
  dateSelect: {
    flex: 1,
    minHeight: 68,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.cardSoft,
    padding: SPACING.sm,
    justifyContent: "center"
  },
  dateSelectLabel: {
    color: COLORS.subtext,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 7
  },
  dateSelectValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4
  },
  dateSelectValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    flexShrink: 1
  },
  dateSelectPlaceholder: { color: COLORS.subtext, fontSize: 14 },
  selectedDatePill: {
    marginTop: SPACING.md,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.muted,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm
  },
  dateSafetyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: SPACING.md
  },
  dateSafetyText: {
    flex: 1,
    color: COLORS.subtext,
    fontSize: 12,
    lineHeight: 18
  },
  selectedDateLabel: { color: COLORS.subtext, fontSize: 12, fontWeight: "900" },
  selectedDateValue: { color: COLORS.text, fontWeight: "900" },
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
  timelineBox: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.xs
  },
  timelineTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", flex: 1 },
  timelineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 9
  },
  timelineBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: "900" },
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
  disclaimer: { fontSize: 12, color: COLORS.subtext, lineHeight: 18, flex: 1 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(8,17,31,0.36)"
  },
  modalDismiss: {
    ...StyleSheet.absoluteFillObject
  },
  pickerSheet: {
    maxHeight: "62%",
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm
  },
  pickerTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  pickerClose: {
    width: 36,
    height: 36,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.muted,
    alignItems: "center",
    justifyContent: "center"
  },
  pickerList: { maxHeight: 360 },
  pickerListContent: { paddingBottom: SPACING.md },
  pickerOption: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  pickerOptionText: { color: COLORS.text, fontSize: 17, fontWeight: "800" }
});

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import {
  createNotificationTrigger,
  getNotificationEnvironment,
  loadNotificationsAsync
} from "../data/notificationService";

export default function RemindersScreen() {
  const { t } = useTranslation();
  const [permission, setPermission] = useState("unknown");

  useEffect(() => {
    (async () => {
      const environment = getNotificationEnvironment();
      if (environment !== "native") {
        setPermission(environment);
        return;
      }

      try {
        const { Notifications } = await loadNotificationsAsync();
        const current = await Notifications.getPermissionsAsync();
        setPermission(current.granted ? "granted" : "undetermined");
      } catch {
        setPermission("undetermined");
      }
    })();
  }, []);

  const ensurePermission = async () => {
    try {
      const { environment, Notifications } = await loadNotificationsAsync();

      if (environment === "web") {
        Alert.alert(t("alerts.webReminderTitle"), t("alerts.webReminderBody"));
        return null;
      }

      if (environment === "expoGo") {
        Alert.alert(t("alerts.expoGoNotificationsTitle"), t("alerts.expoGoNotificationsBody"));
        setPermission("expoGo");
        return null;
      }

      const current = await Notifications.getPermissionsAsync();
      if (current.granted) {
        setPermission("granted");
        return Notifications;
      }

      const requested = await Notifications.requestPermissionsAsync();
      setPermission(requested.granted ? "granted" : "denied");

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

  const testNotif = async () => {
    const Notifications = await ensurePermission();
    if (!Notifications) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t("reminders.testTitle"),
          body: t("reminders.testBody"),
          sound: "default"
        },
        trigger: createNotificationTrigger({ type: "timeInterval", seconds: 3, repeats: false })
      });

      Alert.alert(t("reminders.scheduledTitle"), t("reminders.scheduledBody"));
    } catch {
      Alert.alert(t("alerts.reminderErrorTitle"), t("alerts.reminderErrorBody"));
    }
  };

  const scheduleQuick = async (type, seconds) => {
    const Notifications = await ensurePermission();
    if (!Notifications) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t(`reminders.${type}Title`),
          body: t(`reminders.${type}Body`),
          sound: "default"
        },
        trigger: createNotificationTrigger({ type: "timeInterval", seconds, repeats: false })
      });

      Alert.alert(t("reminders.scheduledTitle"), t("reminders.quickScheduled"));
    } catch {
      Alert.alert(t("alerts.reminderErrorTitle"), t("alerts.reminderErrorBody"));
    }
  };

  const clearAll = async () => {
    try {
      const { environment, Notifications } = await loadNotificationsAsync();

      if (environment === "web") {
        Alert.alert(t("alerts.webReminderTitle"), t("alerts.webReminderBody"));
        return;
      }

      if (environment === "expoGo") {
        Alert.alert(t("alerts.expoGoNotificationsTitle"), t("alerts.expoGoNotificationsBody"));
        setPermission("expoGo");
        return;
      }

      await Notifications.cancelAllScheduledNotificationsAsync();
      Alert.alert(t("notifications.clearedTitle"), t("notifications.clearedBody"));
    } catch {
      Alert.alert(t("alerts.reminderErrorTitle"), t("alerts.reminderErrorBody"));
    }
  };

  const options = [
    { key: "receipt", icon: "mail-unread-outline", seconds: 60 * 60 * 24 * 14 },
    { key: "deadline", icon: "calendar-outline", seconds: 60 * 60 * 24 * 7 },
    { key: "followup", icon: "search-outline", seconds: 60 * 60 * 24 * 30 }
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.iconCircle}>
            <Ionicons name="notifications-outline" size={26} color={COLORS.primary} />
          </View>
          <View style={[styles.statusPill, permission === "granted" && styles.statusPillOk]}>
            <Text style={[styles.statusText, permission === "granted" && styles.statusTextOk]}>
              {permission === "granted" ? t("reminders.statusOn") : t("reminders.statusCheck")}
            </Text>
          </View>
        </View>
        <Text style={styles.title}>{t("reminders.title")}</Text>
        <Text style={styles.subtitle}>{t("reminders.subtitle")}</Text>

        <TouchableOpacity style={styles.btn} onPress={testNotif}>
          <Ionicons name="send-outline" size={18} color={COLORS.primaryTextOn} />
          <Text style={styles.btnText}>{t("reminders.test")}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t("reminders.suggestedTitle")}</Text>

      {options.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.option}
          onPress={() => scheduleQuick(item.key, item.seconds)}
        >
          <View style={styles.optionIcon}>
            <Ionicons name={item.icon} size={21} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{t(`reminders.${item.key}Title`)}</Text>
            <Text style={styles.optionBody}>{t(`reminders.${item.key}Body`)}</Text>
          </View>
          <Ionicons name="add-circle-outline" size={22} color={COLORS.subtext} />
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
        <Text style={styles.clearText}>{t("common.clearReminder")}</Text>
      </TouchableOpacity>

      <Text style={styles.note}>{t("reminders.note")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", gap: SPACING.md, alignItems: "flex-start" },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md
  },
  statusPill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.muted
  },
  statusPillOk: { backgroundColor: "#ECFDF3" },
  statusText: { color: COLORS.subtext, fontWeight: "900", fontSize: 12 },
  statusTextOk: { color: COLORS.success },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.text },
  subtitle: { marginTop: SPACING.sm, color: COLORS.subtext, lineHeight: 20 },
  btn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADII.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...SHADOW.card
  },
  btnText: { color: COLORS.primaryTextOn, fontWeight: "900" },
  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: SPACING.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADII.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight
  },
  optionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  optionBody: { color: COLORS.subtext, marginTop: 4, lineHeight: 20 },
  clearBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  clearText: { color: COLORS.danger, fontWeight: "900" },
  note: { color: COLORS.subtext, lineHeight: 20, fontSize: 12, textAlign: "center" }
});

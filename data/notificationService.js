import Constants from "expo-constants";
import { Platform } from "react-native";

let notificationsModule = null;
let notificationsConfigured = false;

export const REMINDER_CHANNEL_ID = "immigration-reminders";

const isExpoGo = () =>
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";

export const getNotificationEnvironment = () => {
  if (Platform.OS === "web") return "web";
  if (isExpoGo()) return "expoGo";
  return "native";
};

export const loadNotificationsAsync = async () => {
  const environment = getNotificationEnvironment();
  if (environment !== "native") {
    return { environment, Notifications: null };
  }

  if (!notificationsModule) {
    notificationsModule = await import("expo-notifications");
  }

  if (!notificationsConfigured) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true
      })
    });

    if (Platform.OS === "android") {
      await notificationsModule.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: "Immigration reminders",
        importance: notificationsModule.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250]
      });
    }

    notificationsConfigured = true;
  }

  return { environment, Notifications: notificationsModule };
};

export const createNotificationTrigger = (trigger) => (
  Platform.OS === "android"
    ? { ...trigger, channelId: REMINDER_CHANNEL_ID }
    : trigger
);

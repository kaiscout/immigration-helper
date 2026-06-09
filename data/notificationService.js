import Constants from "expo-constants";
import { Platform } from "react-native";

let notificationsModule = null;

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

  return { environment, Notifications: notificationsModule };
};

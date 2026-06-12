import { Alert, Linking } from "react-native";

export async function openExternalLink(url, t) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error("Unsupported URL");
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(t("alerts.linkErrorTitle"), t("alerts.linkErrorBody"));
    return false;
  }
}

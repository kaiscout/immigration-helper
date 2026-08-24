import { Linking } from "react-native";
import { showAlert } from "./appAlert";

export async function openExternalLink(url, t) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error("Unsupported URL");
    await Linking.openURL(url);
    return true;
  } catch {
    showAlert(t("alerts.linkErrorTitle"), t("alerts.linkErrorBody"));
    return false;
  }
}

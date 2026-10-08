import * as MailComposer from "expo-mail-composer";
import { Linking } from "react-native";

export const CASEPILOT_REPORT_EMAIL = "admin@immigrationhelper.org";

const mailtoUrl = ({ subject, body }) =>
  `mailto:${CASEPILOT_REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export async function composeCasePilotReportEmail({ subject, body }) {
  if (await MailComposer.isAvailableAsync()) {
    const result = await MailComposer.composeAsync({
      recipients: [CASEPILOT_REPORT_EMAIL],
      subject,
      body,
      isHtml: false
    });
    return { channel: "mail-composer", status: String(result?.status || "undetermined") };
  }

  const url = mailtoUrl({ subject, body });
  if (!(await Linking.canOpenURL(url))) {
    return { channel: "none", status: "unavailable" };
  }
  await Linking.openURL(url);
  return { channel: "mailto", status: "opened" };
}

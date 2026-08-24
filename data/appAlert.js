import { Alert, Platform } from "react-native";

const browserWindow = () => {
  if (typeof globalThis === "undefined" || !globalThis.window) return null;
  return globalThis.window;
};

const dialogMessage = (title, message) =>
  [title, message]
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map(String)
    .join("\n\n");

const cancelButton = (buttons) => buttons.find((button) => button?.style === "cancel");

export function showAlert(title, message, buttons, options) {
  const webWindow = browserWindow();

  if (Platform.OS !== "web" || !webWindow) {
    Alert.alert(title, message, buttons, options);
    return;
  }

  const actions = Array.isArray(buttons) ? buttons.filter(Boolean) : [];
  const text = dialogMessage(title, message);

  if (actions.length <= 1 && typeof webWindow.alert === "function") {
    webWindow.alert(text);
    actions[0]?.onPress?.();
    return;
  }

  if (actions.length === 2 && typeof webWindow.confirm === "function") {
    const cancel = cancelButton(actions);
    const confirm = actions.find((button) => button !== cancel) || actions[1];

    if (webWindow.confirm(text)) {
      confirm?.onPress?.();
    } else {
      cancel?.onPress?.();
    }
    return;
  }

  if (actions.length >= 3 && typeof webWindow.prompt === "function") {
    const choices = actions
      .map((button, index) => `${index + 1}. ${button.text || index + 1}`)
      .join("\n");
    const selection = webWindow.prompt(`${text}\n\n${choices}`);

    if (selection === null) {
      cancelButton(actions)?.onPress?.();
      return;
    }

    const selectedIndex = Number.parseInt(String(selection).trim(), 10) - 1;
    if (selectedIndex >= 0 && selectedIndex < actions.length) {
      actions[selectedIndex]?.onPress?.();
    }
    return;
  }

  Alert.alert(title, message, buttons, options);
}

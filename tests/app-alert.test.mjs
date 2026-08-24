import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const loadShowAlert = async ({ platform = "web", webWindow } = {}) => {
  const source = await readProjectFile("data/appAlert.js");
  const executable = source
    .replace('import { Alert, Platform } from "react-native";', "")
    .replace("export function showAlert", "function showAlert");
  const nativeCalls = [];
  const showAlert = Function(
    "Alert",
    "Platform",
    "globalThis",
    `${executable}\nreturn showAlert;`
  )(
    { alert: (...args) => nativeCalls.push(args) },
    { OS: platform },
    webWindow ? { window: webWindow } : {}
  );

  return { nativeCalls, showAlert };
};

test("app alerts delegate to React Native outside an available browser window", async () => {
  const { nativeCalls, showAlert } = await loadShowAlert({ platform: "ios" });
  const buttons = [{ text: "OK" }];
  const options = { cancelable: false };

  showAlert("Title", "Body", buttons, options);

  assert.deepEqual(nativeCalls, [["Title", "Body", buttons, options]]);
});

test("web simple alerts display their text and run the single action", async () => {
  const displayed = [];
  let pressed = false;
  const { nativeCalls, showAlert } = await loadShowAlert({
    webWindow: { alert: (message) => displayed.push(message) }
  });

  showAlert("Title", "Body", [{ text: "OK", onPress: () => { pressed = true; } }]);

  assert.deepEqual(displayed, ["Title\n\nBody"]);
  assert.equal(pressed, true);
  assert.deepEqual(nativeCalls, []);
});

test("web confirmations invoke the matching confirm or cancel action", async () => {
  const pressed = [];
  const cancel = { text: "Cancel", style: "cancel", onPress: () => pressed.push("cancel") };
  const confirm = { text: "Delete", style: "destructive", onPress: () => pressed.push("confirm") };
  const accepted = await loadShowAlert({ webWindow: { confirm: () => true } });
  const declined = await loadShowAlert({ webWindow: { confirm: () => false } });

  accepted.showAlert("Delete?", "This cannot be undone.", [cancel, confirm]);
  declined.showAlert("Delete?", "This cannot be undone.", [cancel, confirm]);

  assert.deepEqual(pressed, ["confirm", "cancel"]);
});

test("web multi-choice alerts use a numbered prompt", async () => {
  const pressed = [];
  const { showAlert } = await loadShowAlert({
    webWindow: { prompt: () => "2" }
  });

  showAlert("Status", "Choose one", [
    { text: "Ready", onPress: () => pressed.push("ready") },
    { text: "Needs review", onPress: () => pressed.push("review") },
    { text: "Submitted", onPress: () => pressed.push("submitted") }
  ]);

  assert.deepEqual(pressed, ["review"]);
});

test("all app alert callers use the cross-platform helper", async () => {
  const callers = await Promise.all([
    "screens/RemindersScreen.js",
    "screens/PaywallScreen.js",
    "screens/OnboardingScreen.js",
    "screens/PrivacyScreen.js",
    "screens/FlowScreen.js",
    "screens/FileVaultScreen.js",
    "screens/AIAdvisorScreen.js",
    "components/LanguageDropdown.js",
    "data/externalLinks.js"
  ].map(readProjectFile));

  for (const source of callers) {
    assert.match(source, /import \{ showAlert \} from /);
    assert.match(source, /showAlert\(/);
    assert.doesNotMatch(source, /\bAlert\.alert\(/);
  }
});

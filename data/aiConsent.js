import AsyncStorage from "@react-native-async-storage/async-storage";

export const AI_CONSENT_KEY = "aiDataConsentV1";
export const AI_CONSENT_VERSION = 1;

export async function loadAiConsent() {
  try {
    const raw = await AsyncStorage.getItem(AI_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.accepted === true && parsed?.version === AI_CONSENT_VERSION
      ? {
        accepted: true,
        version: AI_CONSENT_VERSION,
        shareChecklist: parsed.shareChecklist === true,
        acceptedAt: parsed.acceptedAt || null
      }
      : null;
  } catch {
    return null;
  }
}

export async function saveAiConsent({ shareChecklist = false } = {}) {
  const consent = {
    accepted: true,
    version: AI_CONSENT_VERSION,
    shareChecklist: shareChecklist === true,
    acceptedAt: new Date().toISOString()
  };
  await AsyncStorage.setItem(AI_CONSENT_KEY, JSON.stringify(consent));
  return consent;
}

export async function updateChecklistSharing(shareChecklist) {
  const current = await loadAiConsent();
  if (!current) return null;
  const next = { ...current, shareChecklist: shareChecklist === true };
  await AsyncStorage.setItem(AI_CONSENT_KEY, JSON.stringify(next));
  return next;
}

export async function revokeAiConsent() {
  await AsyncStorage.removeItem(AI_CONSENT_KEY);
}

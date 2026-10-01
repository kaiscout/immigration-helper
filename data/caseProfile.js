import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CASE_PROFILE_VERSION,
  hasCaseProfileDetails,
  normalizeCaseProfile
} from "./caseProfileCore.mjs";

export const CASE_PROFILE_KEY = "casePilotProfileV1";

export async function loadCaseProfile() {
  try {
    const raw = await AsyncStorage.getItem(CASE_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CASE_PROFILE_VERSION) return null;
    const profile = normalizeCaseProfile(parsed);
    return hasCaseProfileDetails(profile) ? profile : null;
  } catch {
    return null;
  }
}

export async function saveCaseProfile(value) {
  const profile = normalizeCaseProfile({
    ...value,
    version: CASE_PROFILE_VERSION,
    updatedAt: new Date().toISOString()
  });

  if (!hasCaseProfileDetails(profile)) {
    await AsyncStorage.removeItem(CASE_PROFILE_KEY);
    return null;
  }

  await AsyncStorage.setItem(CASE_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export async function clearCaseProfile() {
  await AsyncStorage.removeItem(CASE_PROFILE_KEY);
}

import AsyncStorage from "@react-native-async-storage/async-storage";

export const LANGUAGE_KEY = "preferredLanguage";

export const loadPreferredLanguage = async () => {
  return AsyncStorage.getItem(LANGUAGE_KEY);
};

export const savePreferredLanguage = async (code) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
};

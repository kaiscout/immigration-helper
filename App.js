import "react-native-gesture-handler";
import i18n from "./i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import OnboardingScreen, { ONBOARDING_KEY } from "./screens/OnboardingScreen";
import HomeScreen from "./screens/HomeScreen";
import FlowScreen from "./screens/FlowScreen";
import RemindersScreen from "./screens/RemindersScreen";
import AIAdvisorScreen from "./screens/AIAdvisorScreen";
import ResourcesScreen from "./screens/ResourcesScreen";
import PrivacyScreen from "./screens/PrivacyScreen";
import { COLORS } from "./constants/theme";
import { loadPreferredLanguage } from "./data/languagePreference";
import LanguageDropdown from "./components/LanguageDropdown";

const Stack = createNativeStackNavigator();

function HeaderResourcesButton({ label, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.headerResourceButton}
      onPress={onPress}
    >
      <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
    </TouchableOpacity>
  );
}

export default function App() {
  const { t } = useTranslation();
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const savedLanguage = await loadPreferredLanguage();
        if (savedLanguage) {
          await i18n.changeLanguage(savedLanguage);
        }

        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setInitialRoute(seen === "true" ? "Home" : "Onboarding");
      } catch {
        setInitialRoute("Onboarding");
      }
    })();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: COLORS.bg },
          headerTitleStyle: { color: COLORS.text, fontWeight: "900" },
          contentStyle: { backgroundColor: COLORS.bg }
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            title: t("home.welcome"),
            headerLeft: () => (
              <HeaderResourcesButton
                label={t("resources.title")}
                onPress={() => navigation.navigate("Resources")}
              />
            ),
            headerRight: () => <LanguageDropdown buttonOnly header />
          })}
        />
        <Stack.Screen
          name="Flow"
          component={FlowScreen}
          options={({ route }) => ({
            title: route.params?.flow?.titleKey ? t(route.params.flow.titleKey) : t("appTitle")
          })}
        />
        <Stack.Screen
          name="AIAdvisor"
          component={AIAdvisorScreen}
          options={{ title: t("ai.title") }}
        />
        <Stack.Screen
          name="Reminders"
          component={RemindersScreen}
          options={{ title: t("reminders.title") }}
        />
        <Stack.Screen
          name="Resources"
          component={ResourcesScreen}
          options={{ title: t("resources.title") }}
        />
        <Stack.Screen
          name="Privacy"
          component={PrivacyScreen}
          options={{ title: t("privacy.title") }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerResourceButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center"
  }
});

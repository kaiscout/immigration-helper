import "react-native-gesture-handler";
import i18n from "./i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import OnboardingScreen, { ONBOARDING_KEY } from "./screens/OnboardingScreen";
import HomeScreen from "./screens/HomeScreen";
import FlowScreen from "./screens/FlowScreen";
import RemindersScreen from "./screens/RemindersScreen";
import AIAdvisorScreen from "./screens/AIAdvisorScreen";
import ResourcesScreen from "./screens/ResourcesScreen";
import PrivacyScreen from "./screens/PrivacyScreen";
import { COLORS } from "./constants/theme";
import { loadPreferredLanguage } from "./data/languagePreference";

const Stack = createNativeStackNavigator();

export default function App() {
  const { t } = useTranslation();
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    (async () => {
      const savedLanguage = await loadPreferredLanguage();
      if (savedLanguage) {
        await i18n.changeLanguage(savedLanguage);
      }

      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      setInitialRoute(seen === "true" ? "Home" : "Onboarding");
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
          options={{ title: t("appTitle") }}
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

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { COLORS, RADII, SHADOW, SPACING, TYPE } from "../constants/theme";
import { FLOWS, loadAllFlowStates } from "../data/flowState";
import { loadVaultFiles } from "../data/fileVaultService";
import {
  buildPlusWorkspaceSummary,
  WORKSPACE_FILE_STATUSES
} from "../data/plusWorkspaceSummary";
import { loadSubscriptionState } from "../data/subscriptionService";

const EMPTY_FLOW_STATES = {};

export default function PlusWorkspaceScreen({ navigation }) {
  const { t } = useTranslation();
  const [subscription, setSubscription] = useState(null);
  const [flowStates, setFlowStates] = useState(EMPTY_FLOW_STATES);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    let nextSubscription;
    try {
      nextSubscription = await loadSubscriptionState();
    } catch {
      nextSubscription = { isPlus: false };
    }
    setSubscription(nextSubscription);

    if (!nextSubscription?.isPlus) {
      navigation.replace("Paywall", { feature: "workspace" });
      return;
    }

    const [flowStatesResult, filesResult] = await Promise.allSettled([
      loadAllFlowStates(),
      loadVaultFiles()
    ]);

    if (flowStatesResult.status === "fulfilled") {
      setFlowStates(flowStatesResult.value);
    }
    if (filesResult.status === "fulfilled") {
      setFiles(Array.isArray(filesResult.value) ? filesResult.value : []);
    }
    setLoading(false);
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadWorkspace();
    }, [loadWorkspace])
  );

  const summary = useMemo(
    () => buildPlusWorkspaceSummary({ flows: FLOWS, flowStates, files }),
    [files, flowStates]
  );

  const suggestedStep = t("workspace.suggestedNextStepBody", {
    defaultValue: "Add your latest notice to File Vault, then mark the next checklist step."
  });

  const statusCards = [
    {
      status: WORKSPACE_FILE_STATUSES[0],
      label: t("vault.statusReady", { defaultValue: "Ready" }),
      color: COLORS.success
    },
    {
      status: WORKSPACE_FILE_STATUSES[1],
      label: t("vault.statusNeedsReview", { defaultValue: "Needs review" }),
      color: COLORS.warning
    },
    {
      status: WORKSPACE_FILE_STATUSES[2],
      label: t("vault.statusSubmitted", { defaultValue: "Submitted" }),
      color: "#6D28D9"
    }
  ];

  if (loading || !subscription?.isPlus) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="lock-closed-outline" size={23} color={COLORS.primaryTextOn} />
          </View>
          <View style={[styles.statusPill, !subscription?.isPlus && styles.statusPillInactive]}>
            <Text style={styles.statusPillText}>
              {subscription === null
                ? t("workspace.plusChecking", { defaultValue: "Checking Plus" })
                : subscription.isPlus
                ? t("workspace.plusActive", { defaultValue: "Plus active" })
                : t("plus.statusInactive", { defaultValue: "Plus not active" })}
            </Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>
          {t("workspace.heroTitle", { defaultValue: "Your private immigration workspace" })}
        </Text>
        <Text style={styles.heroBody}>
          {t("workspace.heroBody", {
            defaultValue: "Checklists, saved files, dates, and next steps in one calm place."
          })}
        </Text>
      </View>

      <View style={styles.suggestionCard}>
        <View style={styles.softIcon}>
          <Ionicons name="arrow-forward" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.suggestionCopy}>
          <Text style={styles.suggestionTitle}>
            {t("workspace.suggestedNextStep", { defaultValue: "Suggested next step" })}
          </Text>
          <Text style={styles.suggestionBody}>{suggestedStep}</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard
          value={summary.savedFiles}
          label={t("workspace.savedFiles", { defaultValue: "Saved files" })}
        />
        <SummaryCard
          value={summary.savedDates}
          label={t("workspace.savedDates", { defaultValue: "Saved dates" })}
        />
        <SummaryCard
          value={`${summary.averageProgress}%`}
          label={t("workspace.averageProgress", { defaultValue: "Avg progress" })}
        />
      </View>

      <View style={styles.entryRow}>
        <WorkspaceEntry
          icon="folder-open-outline"
          title={t("vault.title", { defaultValue: "File Vault" })}
          body={t("workspace.vaultSubtitle", { defaultValue: "Save files locally." })}
          onPress={() => navigation.navigate("FileVault")}
        />
        <WorkspaceEntry
          icon="chatbubble-ellipses-outline"
          title={t("ai.title", { defaultValue: "CasePilot" })}
          body={t("workspace.aiSubtitle", { defaultValue: "Ask checklist-aware questions." })}
          onPress={() => navigation.navigate("AIAdvisor")}
        />
      </View>

      <Text style={styles.sectionTitle}>
        {t("workspace.checklistProgress", { defaultValue: "Checklist progress" })}
      </Text>
      <View style={styles.progressList}>
        {summary.progress.map((item) => {
          const title = t(item.flow?.titleKey || "workspace.process", {
            defaultValue: item.flow?.id || "Process"
          });
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.progressCard}
              onPress={() => navigation.navigate("Flow", { flow: item.flow })}
              accessibilityRole="button"
              accessibilityLabel={title}
            >
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>{title}</Text>
                <Text style={styles.progressPercent}>{item.percent}%</Text>
              </View>
              <View style={styles.progressMetaRow}>
                <Text style={styles.progressMeta}>
                  {t("workspace.stepsComplete", {
                    completed: item.completed,
                    total: item.total,
                    defaultValue: "{{completed}}/{{total}} steps"
                  })}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${item.percent}%` }]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>
        {t("workspace.fileStatus", { defaultValue: "File status" })}
      </Text>
      <View style={styles.fileStatusRow}>
        {statusCards.map((card) => (
          <View key={card.status} style={styles.fileStatusCard}>
            <View style={styles.fileStatusTop}>
              <View style={styles.statusDotWrap}>
                <View style={[styles.statusDot, { backgroundColor: card.color }]} />
              </View>
              <Text style={[styles.fileStatusCount, { color: card.color }]}>
                {summary.fileStatuses[card.status]}
              </Text>
            </View>
            <Text style={styles.fileStatusLabel}>{card.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SummaryCard({ value, label }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function WorkspaceEntry({ icon, title, body, onPress }) {
  return (
    <TouchableOpacity
      style={styles.entryCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.softIcon}>
        <Ionicons name={icon} size={21} color={COLORS.primary} />
      </View>
      <View style={styles.entryCopy}>
        <Text style={styles.entryTitle}>{title}</Text>
        <Text style={styles.entryBody}>{body}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg
  },
  screen: { flex: 1, backgroundColor: COLORS.bg },
  wrap: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md
  },
  hero: {
    backgroundColor: "#0F172A",
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    ...SHADOW.card
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginBottom: SPACING.md
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  statusPill: {
    borderRadius: RADII.pill,
    backgroundColor: "#24334A",
    paddingHorizontal: SPACING.md,
    paddingVertical: 8
  },
  statusPillInactive: { backgroundColor: "#713F12" },
  statusPillText: { color: COLORS.primaryTextOn, fontSize: 13, fontWeight: "800" },
  heroTitle: { color: COLORS.primaryTextOn, ...TYPE.title, maxWidth: 520 },
  heroBody: {
    color: "#CBD5E1",
    fontSize: 16,
    lineHeight: 23,
    marginTop: SPACING.xs,
    maxWidth: 650
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    ...SHADOW.soft
  },
  softIcon: {
    width: 42,
    height: 42,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.bg2,
    alignItems: "center",
    justifyContent: "center"
  },
  suggestionCopy: { flex: 1 },
  suggestionTitle: { color: COLORS.text, fontSize: 17, lineHeight: 22, fontWeight: "900" },
  suggestionBody: { color: COLORS.subtext, marginTop: 3, fontSize: 14, lineHeight: 20 },
  summaryRow: { flexDirection: "row", gap: SPACING.sm },
  summaryCard: {
    flex: 1,
    minWidth: 82,
    minHeight: 104,
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.xl,
    padding: SPACING.md,
    ...SHADOW.soft
  },
  summaryValue: { color: COLORS.primary, fontSize: 29, lineHeight: 34, fontWeight: "900" },
  summaryLabel: { color: COLORS.subtext, fontSize: 13, lineHeight: 18, marginTop: 4 },
  entryRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md, marginTop: SPACING.sm },
  entryCard: {
    flex: 1,
    minWidth: 150,
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    ...SHADOW.soft
  },
  entryCopy: { flex: 1 },
  entryTitle: { color: COLORS.text, fontSize: 17, lineHeight: 22, fontWeight: "900" },
  entryBody: { color: COLORS.subtext, fontSize: 13, lineHeight: 18, marginTop: 3 },
  sectionTitle: { color: COLORS.text, ...TYPE.section, marginTop: SPACING.lg },
  progressList: { gap: SPACING.md },
  progressCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    ...SHADOW.soft
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md
  },
  progressTitle: { color: COLORS.text, fontSize: 17, lineHeight: 22, fontWeight: "900", flex: 1 },
  progressPercent: { color: COLORS.primary, fontSize: 17, lineHeight: 22, fontWeight: "900" },
  progressMetaRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginTop: SPACING.sm },
  progressMeta: { color: COLORS.subtext, fontSize: 13, lineHeight: 18, minWidth: 82 },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.muted,
    overflow: "hidden"
  },
  progressFill: { height: 10, borderRadius: RADII.pill, backgroundColor: COLORS.primary },
  fileStatusRow: { flexDirection: "row", gap: SPACING.sm },
  fileStatusCard: {
    flex: 1,
    minWidth: 82,
    minHeight: 102,
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.xl,
    padding: SPACING.md,
    ...SHADOW.soft
  },
  fileStatusTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDotWrap: {
    width: 28,
    height: 28,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.bg2,
    alignItems: "center",
    justifyContent: "center"
  },
  statusDot: { width: 7, height: 7, borderRadius: RADII.pill },
  fileStatusCount: { fontSize: 21, lineHeight: 26, fontWeight: "900" },
  fileStatusLabel: { color: COLORS.subtext, fontSize: 13, lineHeight: 18, marginTop: SPACING.xs }
});

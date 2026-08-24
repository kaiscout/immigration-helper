import { useCallback, useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADII, SHADOW, SPACING } from "../constants/theme";
import {
  MAX_VAULT_NOTE_LENGTH,
  VAULT_ACTIONS,
  VAULT_CATEGORIES,
  VAULT_STATUSES,
  fileVaultReducer
} from "../data/fileVaultModel.mjs";
import {
  deleteVaultFile,
  importVaultFile,
  loadVaultFiles,
  shareVaultFile,
  updateVaultFile
} from "../data/fileVaultService";
import { loadSubscriptionState } from "../data/subscriptionService";
import { showAlert } from "../data/appAlert";

const STATUS_STYLES = {
  Ready: { backgroundColor: "#ECFDF3", color: COLORS.success },
  "Needs review": { backgroundColor: "#FFF7E6", color: COLORS.warning },
  Submitted: { backgroundColor: "#F3E8FF", color: "#7C3AED" }
};

const statusLabel = (t, status) => {
  const labels = {
    Ready: t("fileVault.statusReady", { defaultValue: "Ready" }),
    "Needs review": t("fileVault.statusNeedsReview", { defaultValue: "Needs review" }),
    Submitted: t("fileVault.statusSubmitted", { defaultValue: "Submitted" })
  };
  return labels[status] || status;
};

const categoryLabel = (t, category) => {
  const keys = {
    TPS: ["fileVault.categoryTps", "TPS"],
    "Work Permit": ["fileVault.categoryWorkPermit", "Work Permit"],
    Travel: ["fileVault.categoryTravel", "Travel"],
    Notices: ["fileVault.categoryNotices", "Notices"],
    Evidence: ["fileVault.categoryEvidence", "Evidence"]
  };
  const [key, fallback] = keys[category] || ["fileVault.categoryOther", category];
  return t(key, { defaultValue: fallback });
};

const errorMessage = (t, code) => {
  const messages = {
    UNSUPPORTED_PLATFORM: t("fileVault.errorNativeOnly", {
      defaultValue: "File Vault imports are available in the iPhone or Android app. Your files are never uploaded."
    }),
    PICKER_UNAVAILABLE: t("fileVault.errorPickerUnavailable", {
      defaultValue: "The file picker is not available on this device."
    }),
    PICKER_ERROR: t("fileVault.errorPicker", {
      defaultValue: "The file picker could not open. Please try again."
    }),
    INVALID_ASSET: t("fileVault.errorInvalidFile", {
      defaultValue: "That file could not be read. Please choose it again."
    }),
    UNSUPPORTED_TYPE: t("fileVault.errorType", {
      defaultValue: "Choose a PDF or image file."
    }),
    EMPTY_FILE: t("fileVault.errorEmpty", {
      defaultValue: "That file is empty. Choose a different PDF or image."
    }),
    FILE_TOO_LARGE: t("fileVault.errorTooLarge", {
      defaultValue: "That file is too large. File Vault supports files up to 50 MB."
    }),
    COPY_FAILED: t("fileVault.errorCopy", {
      defaultValue: "The file could not be saved on this device. Check available storage and try again."
    }),
    STORAGE_ERROR: t("fileVault.errorStorage", {
      defaultValue: "File Vault could not save your changes. Please try again."
    }),
    FILESYSTEM_UNAVAILABLE: t("fileVault.errorFilesystem", {
      defaultValue: "Local file storage is not available right now. Please restart the app and try again."
    }),
    MISSING_FILE: t("fileVault.errorMissing", {
      defaultValue: "This file is no longer on the device. You can remove its saved entry below."
    }),
    SHARE_UNAVAILABLE: t("fileVault.errorShareUnavailable", {
      defaultValue: "File sharing is not available on this device."
    }),
    SHARE_FAILED: t("fileVault.errorShare", {
      defaultValue: "The share sheet could not open. Please try again."
    }),
    DELETE_FAILED: t("fileVault.errorDelete", {
      defaultValue: "The file could not be deleted. Please try again."
    }),
    NOT_FOUND: t("fileVault.errorNotFound", {
      defaultValue: "That saved file was not found. Refresh File Vault and try again."
    })
  };
  return messages[code] || t("fileVault.errorGeneric", {
    defaultValue: "Something went wrong. Please try again."
  });
};

const showVaultError = (t, error) => showAlert(
  t("fileVault.errorTitle", { defaultValue: "File Vault" }),
  errorMessage(t, error?.code)
);

function VaultFileCard({ file, busy, onDelete, onShare, onUpdate }) {
  const { t } = useTranslation();
  const [note, setNote] = useState(file.note || "");
  const statusStyle = STATUS_STYLES[file.status] || STATUS_STYLES.Ready;
  const isPdf = file.mimeType === "application/pdf";

  useEffect(() => {
    setNote(file.note || "");
  }, [file.id, file.note]);

  const saveNote = async () => {
    const nextNote = note.trim();
    if (nextNote === (file.note || "")) return;

    try {
      await onUpdate(file, { note: nextNote });
    } catch (error) {
      setNote(file.note || "");
      showVaultError(t, error);
    }
  };

  const chooseStatus = () => {
    showAlert(
      t("fileVault.changeStatus", { defaultValue: "Change status" }),
      file.name,
      [
        ...VAULT_STATUSES.map((status) => ({
          text: statusLabel(t, status),
          onPress: async () => {
            if (status === file.status) return;
            try {
              await onUpdate(file, { status });
            } catch (error) {
              showVaultError(t, error);
            }
          }
        })),
        { text: t("fileVault.cancel", { defaultValue: "Cancel" }), style: "cancel" }
      ]
    );
  };

  return (
    <View style={[styles.fileCard, file.isMissing && styles.missingCard]}>
      <View style={styles.fileTopRow}>
        <View style={styles.fileIcon}>
          <Ionicons
            name={isPdf ? "document-text-outline" : "image-outline"}
            size={22}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.fileHeading}>
          <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
          <Text style={styles.fileCategory}>{categoryLabel(t, file.category)}</Text>
        </View>

        {file.isMissing ? (
          <View style={styles.missingPill}>
            <Text style={styles.missingPillText}>
              {t("fileVault.missing", { defaultValue: "Missing" })}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.statusPill, { backgroundColor: statusStyle.backgroundColor }]}
            onPress={chooseStatus}
            accessibilityRole="button"
            accessibilityLabel={t("fileVault.changeStatusLabel", {
              defaultValue: `Status: ${statusLabel(t, file.status)}. Double tap to change.`
            })}
            disabled={busy}
          >
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {statusLabel(t, file.status)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={setNote}
        onBlur={saveNote}
        onSubmitEditing={saveNote}
        placeholder={t("fileVault.notePlaceholder", { defaultValue: "Add a private note…" })}
        placeholderTextColor={COLORS.subtext}
        multiline
        maxLength={MAX_VAULT_NOTE_LENGTH}
        editable={!busy}
        accessibilityLabel={t("fileVault.privateNoteLabel", { defaultValue: `Private note for ${file.name}` })}
      />

      <View style={styles.fileActions}>
        <TouchableOpacity
          style={styles.fileAction}
          onPress={() => onShare(file)}
          disabled={busy || file.isMissing}
          accessibilityRole="button"
          accessibilityLabel={t("fileVault.shareFileLabel", { defaultValue: `Share ${file.name}` })}
        >
          <Ionicons
            name="share-outline"
            size={18}
            color={busy || file.isMissing ? COLORS.subtext : COLORS.primary}
          />
          <Text style={[styles.shareText, (busy || file.isMissing) && styles.disabledText]}>
            {t("fileVault.share", { defaultValue: "Share" })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fileAction}
          onPress={() => onDelete(file)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("fileVault.deleteFileLabel", { defaultValue: `Delete ${file.name}` })}
        >
          {busy ? (
            <ActivityIndicator size="small" color={COLORS.danger} />
          ) : (
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          )}
          <Text style={styles.deleteText}>{t("fileVault.delete", { defaultValue: "Delete" })}</Text>
        </TouchableOpacity>
      </View>

      {file.isMissing ? (
        <Text style={styles.missingMessage}>
          {t("fileVault.missingBody", {
            defaultValue: "The local file is missing. Delete this entry to clean up File Vault."
          })}
        </Text>
      ) : null}
    </View>
  );
}

export default function FileVaultScreen({ navigation }) {
  const { t } = useTranslation();
  const [files, dispatch] = useReducer(fileVaultReducer, []);
  const [selectedCategory, setSelectedCategory] = useState(VAULT_CATEGORIES[0]);
  const [loading, setLoading] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const subscription = await loadSubscriptionState();
      if (!subscription?.isPlus) {
        setAccessGranted(false);
        navigation.replace("Paywall", { feature: "workspace" });
        return;
      }
      setAccessGranted(true);
      const stored = await loadVaultFiles();
      dispatch({ type: VAULT_ACTIONS.HYDRATE, files: stored });
    } catch (error) {
      showVaultError(t, error);
    } finally {
      setLoading(false);
    }
  }, [navigation, t]);

  useEffect(() => {
    refresh();
    const unsubscribe = navigation?.addListener?.("focus", refresh);
    return unsubscribe;
  }, [navigation, refresh]);

  if (loading || !accessGranted) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const addFile = async () => {
    if (adding) return;
    setAdding(true);
    try {
      const record = await importVaultFile(selectedCategory);
      if (record) dispatch({ type: VAULT_ACTIONS.ADD, file: record });
    } catch (error) {
      showVaultError(t, error);
    } finally {
      setAdding(false);
    }
  };

  const updateFile = async (file, changes) => {
    setBusyId(file.id);
    try {
      const updated = await updateVaultFile(file.id, changes);
      dispatch({
        type: VAULT_ACTIONS.UPDATE,
        file: { ...updated, isMissing: file.isMissing }
      });
      return updated;
    } finally {
      setBusyId(null);
    }
  };

  const shareFile = async (file) => {
    setBusyId(file.id);
    try {
      await shareVaultFile(file);
    } catch (error) {
      showVaultError(t, error);
    } finally {
      setBusyId(null);
    }
  };

  const removeFile = (file) => {
    showAlert(
      t("fileVault.deleteTitle", { defaultValue: "Delete this file?" }),
      t("fileVault.deleteBody", {
        defaultValue: `“${file.name}” and its private note will be permanently removed from this device.`
      }),
      [
        { text: t("fileVault.cancel", { defaultValue: "Cancel" }), style: "cancel" },
        {
          text: t("fileVault.delete", { defaultValue: "Delete" }),
          style: "destructive",
          onPress: async () => {
            setBusyId(file.id);
            try {
              await deleteVaultFile(file);
              dispatch({ type: VAULT_ACTIONS.REMOVE, id: file.id });
            } catch (error) {
              showVaultError(t, error);
            } finally {
              setBusyId(null);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="folder-open-outline" size={27} color={COLORS.primaryTextOn} />
        </View>
        <Text style={styles.heroTitle}>
          {t("fileVault.heroTitle", { defaultValue: "Keep important files organized" })}
        </Text>
        <Text style={styles.heroBody}>
          {t("fileVault.heroBody", { defaultValue: "Save PDFs and images locally with private notes." })}
        </Text>
      </View>

      <View style={styles.localNotice}>
        <Ionicons name="phone-portrait-outline" size={22} color={COLORS.success} />
        <View style={{ flex: 1 }}>
          <Text style={styles.localNoticeTitle}>
            {t("fileVault.localTitle", { defaultValue: "Stored locally on this device" })}
          </Text>
          <Text style={styles.localNoticeBody}>
            {t("fileVault.localBody", {
              defaultValue: "Files are not uploaded to Immigration Helper or AI."
            })}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {t("fileVault.saveUnder", { defaultValue: "Save under" })}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {VAULT_CATEGORIES.map((category) => {
          const selected = category === selectedCategory;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.categoryChip, selected && styles.categoryChipSelected]}
              onPress={() => setSelectedCategory(category)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                {categoryLabel(t, category)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.addButton, adding && styles.addButtonDisabled]}
        onPress={addFile}
        disabled={adding}
        accessibilityRole="button"
        accessibilityLabel={t("fileVault.add", { defaultValue: "Add PDF or image" })}
      >
        {adding ? (
          <ActivityIndicator color={COLORS.primaryTextOn} />
        ) : (
          <Ionicons name="add" size={22} color={COLORS.primaryTextOn} />
        )}
        <Text style={styles.addButtonText}>
          {adding
            ? t("fileVault.adding", { defaultValue: "Saving locally…" })
            : t("fileVault.add", { defaultValue: "Add PDF or image" })}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, styles.savedTitle]}>
        {t("fileVault.savedFiles", { defaultValue: "Saved files" })}
      </Text>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t("fileVault.loading", { defaultValue: "Loading files…" })}
          </Text>
        </View>
      ) : files.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="documents-outline" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {t("fileVault.emptyTitle", { defaultValue: "No saved files yet" })}
          </Text>
          <Text style={styles.emptyBody}>
            {t("fileVault.emptyBody", {
              defaultValue: "Choose a category, then add a PDF or image from your device."
            })}
          </Text>
        </View>
      ) : files.map((file) => (
        <VaultFileCard
          key={file.id}
          file={file}
          busy={busyId === file.id}
          onDelete={removeFile}
          onShare={shareFile}
          onUpdate={updateFile}
        />
      ))}

      <View style={styles.footerNote}>
        <Ionicons name="shield-checkmark-outline" size={17} color={COLORS.subtext} />
        <Text style={styles.footerNoteText}>
          {t("fileVault.backupNotice", {
            defaultValue: "Deleting the app may remove these files. Keep a separate backup of important originals."
          })}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg
  },
  wrap: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md
  },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: RADII.xl,
    padding: SPACING.xl,
    ...SHADOW.card
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md
  },
  heroTitle: { color: COLORS.primaryTextOn, fontSize: 25, lineHeight: 31, fontWeight: "900" },
  heroBody: { color: "rgba(255,255,255,0.86)", fontSize: 15, lineHeight: 21, marginTop: SPACING.sm },
  localNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#BBF7D0"
  },
  localNoticeTitle: { color: "#166534", fontWeight: "900", fontSize: 16 },
  localNoticeBody: { color: "#166534", marginTop: 3, lineHeight: 20 },
  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 21, marginTop: SPACING.xs },
  savedTitle: { marginTop: SPACING.md },
  categoryRow: { gap: SPACING.sm, paddingRight: SPACING.lg },
  categoryChip: {
    minHeight: 42,
    justifyContent: "center",
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  categoryChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText: { color: COLORS.text, fontWeight: "800" },
  categoryTextSelected: { color: COLORS.primaryTextOn },
  addButton: {
    minHeight: 56,
    borderRadius: RADII.xl,
    paddingHorizontal: SPACING.lg,
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    ...SHADOW.card
  },
  addButtonDisabled: { opacity: 0.72 },
  addButtonText: { color: COLORS.primaryTextOn, fontWeight: "900", fontSize: 17 },
  fileCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  missingCard: { borderColor: "#FECACA" },
  fileTopRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  fileIcon: {
    width: 42,
    height: 42,
    borderRadius: RADII.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight
  },
  fileHeading: { flex: 1, minWidth: 0 },
  fileName: { color: COLORS.text, fontWeight: "900", fontSize: 17, lineHeight: 22 },
  fileCategory: { color: COLORS.subtext, marginTop: 3 },
  statusPill: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: RADII.pill },
  statusText: { fontSize: 12, fontWeight: "900" },
  missingPill: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: RADII.pill, backgroundColor: "#FEF2F2" },
  missingPillText: { color: COLORS.danger, fontSize: 12, fontWeight: "900" },
  noteInput: {
    minHeight: 54,
    maxHeight: 130,
    marginTop: SPACING.md,
    marginLeft: 52,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSoft,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    textAlignVertical: "top",
    lineHeight: 20
  },
  fileActions: { flexDirection: "row", gap: SPACING.xl, marginTop: SPACING.md, marginLeft: 52 },
  fileAction: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6 },
  shareText: { color: COLORS.primary, fontWeight: "900" },
  deleteText: { color: COLORS.danger, fontWeight: "900" },
  disabledText: { color: COLORS.subtext },
  missingMessage: { color: COLORS.danger, fontSize: 12, lineHeight: 17, marginTop: SPACING.sm, marginLeft: 52 },
  loadingBox: { alignItems: "center", justifyContent: "center", paddingVertical: SPACING.xl, gap: SPACING.sm },
  loadingText: { color: COLORS.subtext },
  emptyCard: {
    alignItems: "center",
    padding: SPACING.xl,
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.soft
  },
  emptyIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.pill,
    backgroundColor: COLORS.primaryLight,
    marginBottom: SPACING.md
  },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  emptyBody: { color: COLORS.subtext, textAlign: "center", lineHeight: 20, marginTop: SPACING.sm },
  footerNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: SPACING.sm, paddingHorizontal: SPACING.sm },
  footerNoteText: { color: COLORS.subtext, fontSize: 12, lineHeight: 18, flex: 1 }
});

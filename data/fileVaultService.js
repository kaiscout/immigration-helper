import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  FILE_VAULT_SCHEMA_VERSION,
  MAX_VAULT_FILE_SIZE_BYTES,
  applyVaultPatch,
  createVaultId,
  createVaultRecord,
  makeStorageFileName,
  normalizeVaultRecord,
  sortVaultFiles,
  validateImportAsset
} from "./fileVaultModel.mjs";

export const FILE_VAULT_STORAGE_KEY = "immigrationHelperFileVaultV1";

export class FileVaultError extends Error {
  constructor(code, cause) {
    super(code);
    this.name = "FileVaultError";
    this.code = code;
    this.cause = cause;
  }
}

let mutationQueue = Promise.resolve();

const enqueueMutation = (operation) => {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.catch(() => undefined);
  return result;
};

const persistedRecord = (record) => {
  const { isMissing: _isMissing, ...value } = record;
  return value;
};

async function readStoredFiles() {
  let raw;
  try {
    raw = await AsyncStorage.getItem(FILE_VAULT_STORAGE_KEY);
  } catch (error) {
    throw new FileVaultError("STORAGE_ERROR", error);
  }

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const values = Array.isArray(parsed) ? parsed : parsed?.files;
    return sortVaultFiles(
      (Array.isArray(values) ? values : [])
        .map(normalizeVaultRecord)
        .filter(Boolean)
    );
  } catch {
    return [];
  }
}

async function writeStoredFiles(files) {
  try {
    await AsyncStorage.setItem(FILE_VAULT_STORAGE_KEY, JSON.stringify({
      version: FILE_VAULT_SCHEMA_VERSION,
      files: sortVaultFiles(files).map(persistedRecord)
    }));
  } catch (error) {
    throw new FileVaultError("STORAGE_ERROR", error);
  }
}

async function loadFileSystem() {
  try {
    return await import("expo-file-system");
  } catch (error) {
    throw new FileVaultError("FILESYSTEM_UNAVAILABLE", error);
  }
}

async function annotateMissingFiles(files) {
  if (Platform.OS === "web") return files;

  let File;
  try {
    ({ File } = await loadFileSystem());
  } catch {
    return files;
  }

  return files.map((record) => {
    try {
      return { ...record, isMissing: !new File(record.uri).exists };
    } catch {
      return { ...record, isMissing: true };
    }
  });
}

export async function loadVaultFiles() {
  return annotateMissingFiles(await readStoredFiles());
}

export async function importVaultFile(category) {
  if (Platform.OS === "web") {
    throw new FileVaultError("UNSUPPORTED_PLATFORM");
  }

  let DocumentPicker;
  try {
    DocumentPicker = await import("expo-document-picker");
  } catch (error) {
    throw new FileVaultError("PICKER_UNAVAILABLE", error);
  }

  let result;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false
    });
  } catch (error) {
    throw new FileVaultError("PICKER_ERROR", error);
  }

  if (result?.canceled) return null;
  const asset = result?.assets?.[0];
  const validation = validateImportAsset(asset);
  if (!validation.valid) throw new FileVaultError(validation.code);

  return enqueueMutation(async () => {
    const { Directory, File, Paths } = await loadFileSystem();
    const id = createVaultId();
    const directory = new Directory(Paths.document, "file-vault");
    const destination = new File(directory, makeStorageFileName(id, validation.value.name));
    let copiedSize = validation.value.size;

    try {
      directory.create({ idempotent: true, intermediates: true });
      const source = new File(validation.value.uri);
      if (!source.exists) throw new Error("Picked file is not readable");
      const sourceInfo = source.info();
      if (typeof sourceInfo?.size === "number" && Number.isFinite(sourceInfo.size)) {
        copiedSize = sourceInfo.size;
      }
      if (copiedSize === 0) throw new FileVaultError("EMPTY_FILE");
      if (copiedSize !== null && copiedSize > MAX_VAULT_FILE_SIZE_BYTES) {
        throw new FileVaultError("FILE_TOO_LARGE");
      }
      source.copy(destination);
    } catch (error) {
      if (error instanceof FileVaultError) throw error;
      throw new FileVaultError("COPY_FAILED", error);
    }

    const record = createVaultRecord({ ...validation.value, size: copiedSize }, {
      category,
      destinationUri: destination.uri,
      id
    });

    try {
      const files = await readStoredFiles();
      await writeStoredFiles([record, ...files]);
      return record;
    } catch (error) {
      try {
        if (destination.exists) destination.delete();
      } catch {
        // The metadata error remains the actionable failure.
      }
      throw error;
    }
  });
}

export async function updateVaultFile(id, changes) {
  return enqueueMutation(async () => {
    const files = await readStoredFiles();
    const index = files.findIndex((file) => file.id === id);
    if (index < 0) throw new FileVaultError("NOT_FOUND");

    const updated = applyVaultPatch(files[index], changes);
    const next = [...files];
    next[index] = updated;
    await writeStoredFiles(next);
    return updated;
  });
}

export async function deleteVaultFile(record) {
  if (!record?.id) throw new FileVaultError("NOT_FOUND");

  return enqueueMutation(async () => {
    const files = await readStoredFiles();
    const stored = files.find((file) => file.id === record.id);
    if (!stored) return false;

    if (Platform.OS !== "web") {
      try {
        const { File } = await loadFileSystem();
        const file = new File(stored.uri);
        if (file.exists) file.delete();
      } catch (error) {
        throw new FileVaultError("DELETE_FAILED", error);
      }
    }

    await writeStoredFiles(files.filter((file) => file.id !== stored.id));
    return true;
  });
}

export async function shareVaultFile(record) {
  if (Platform.OS === "web") throw new FileVaultError("SHARE_UNAVAILABLE");
  if (!record?.uri) throw new FileVaultError("NOT_FOUND");

  const { File } = await loadFileSystem();
  let file;
  try {
    file = new File(record.uri);
  } catch (error) {
    throw new FileVaultError("MISSING_FILE", error);
  }
  if (!file.exists) throw new FileVaultError("MISSING_FILE");

  let Sharing;
  try {
    Sharing = await import("expo-sharing");
    if (!await Sharing.isAvailableAsync()) {
      throw new FileVaultError("SHARE_UNAVAILABLE");
    }
    await Sharing.shareAsync(file.uri, {
      dialogTitle: record.name,
      mimeType: record.mimeType || undefined
    });
  } catch (error) {
    if (error instanceof FileVaultError) throw error;
    throw new FileVaultError("SHARE_FAILED", error);
  }
}

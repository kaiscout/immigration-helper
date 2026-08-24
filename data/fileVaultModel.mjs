export const FILE_VAULT_SCHEMA_VERSION = 1;
export const MAX_VAULT_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_VAULT_NOTE_LENGTH = 2000;

export const VAULT_CATEGORIES = Object.freeze([
  "TPS",
  "Work Permit",
  "Travel",
  "Notices",
  "Evidence"
]);

export const VAULT_STATUSES = Object.freeze([
  "Ready",
  "Needs review",
  "Submitted"
]);

export const VAULT_ACTIONS = Object.freeze({
  HYDRATE: "hydrate",
  ADD: "add",
  UPDATE: "update",
  REMOVE: "remove"
});

const IMAGE_EXTENSIONS = new Set([
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "tif",
  "tiff",
  "webp"
]);

const GENERIC_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream"
]);

const asText = (value) => typeof value === "string" ? value : "";

export function sanitizeDisplayName(value, fallback = "document") {
  const leafName = asText(value)
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  return (leafName || fallback).slice(0, 160);
}

export function fileExtension(name) {
  const match = sanitizeDisplayName(name, "").match(/\.([a-zA-Z0-9]{1,10})$/);
  return match?.[1]?.toLowerCase() || "";
}

export function inferVaultMimeType(name, providedMimeType = "") {
  const mimeType = asText(providedMimeType).trim().toLowerCase();
  if (!GENERIC_MIME_TYPES.has(mimeType)) return mimeType;

  const extension = fileExtension(name);
  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "tif" || extension === "tiff") return "image/tiff";
  if (IMAGE_EXTENSIONS.has(extension)) return `image/${extension}`;
  return mimeType;
}

export function validateImportAsset(asset, { maxBytes = MAX_VAULT_FILE_SIZE_BYTES } = {}) {
  if (!asset || typeof asset !== "object" || !asText(asset.uri).trim()) {
    return { valid: false, code: "INVALID_ASSET" };
  }

  const name = sanitizeDisplayName(asset.name || asset.uri, "document");
  const providedMimeType = asText(asset.mimeType).trim().toLowerCase();
  const mimeType = inferVaultMimeType(name, providedMimeType);
  const extension = fileExtension(name);
  const genericMimeType = GENERIC_MIME_TYPES.has(providedMimeType);
  const supportedByMime = mimeType === "application/pdf" || mimeType.startsWith("image/");
  const supportedByExtension = extension === "pdf" || IMAGE_EXTENSIONS.has(extension);

  if (!supportedByMime || (genericMimeType && !supportedByExtension)) {
    return { valid: false, code: "UNSUPPORTED_TYPE" };
  }

  const parsedSize = Number(asset.size);
  const size = Number.isFinite(parsedSize) && parsedSize >= 0 ? parsedSize : null;
  if (size === 0) return { valid: false, code: "EMPTY_FILE" };
  if (size !== null && size > maxBytes) {
    return { valid: false, code: "FILE_TOO_LARGE", maxBytes };
  }

  return {
    valid: true,
    value: {
      name,
      uri: asset.uri.trim(),
      mimeType,
      size
    }
  };
}

export function createVaultId(now = Date.now(), randomValue = Math.random()) {
  const randomPart = Math.floor(Math.abs(randomValue % 1) * 0xFFFFFFFF)
    .toString(36)
    .padStart(6, "0");
  return `vault-${Number(now).toString(36)}-${randomPart}`;
}

export function makeStorageFileName(id, displayName) {
  const safeId = asText(id).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80) || "vault-file";
  const extension = fileExtension(displayName);
  return extension ? `${safeId}.${extension}` : safeId;
}

export function createVaultRecord(asset, {
  category = VAULT_CATEGORIES[0],
  destinationUri,
  id = createVaultId(),
  now = new Date().toISOString()
} = {}) {
  const validation = validateImportAsset(asset);
  if (!validation.valid) {
    const error = new Error(validation.code);
    error.code = validation.code;
    throw error;
  }

  const timestamp = asText(now) || new Date().toISOString();
  return {
    id: asText(id),
    name: validation.value.name,
    uri: asText(destinationUri || validation.value.uri),
    mimeType: validation.value.mimeType,
    size: validation.value.size,
    category: VAULT_CATEGORIES.includes(category) ? category : VAULT_CATEGORIES[0],
    status: VAULT_STATUSES[0],
    note: "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function normalizeVaultRecord(value) {
  if (!value || typeof value !== "object") return null;
  const id = asText(value.id).trim();
  const uri = asText(value.uri).trim();
  if (!id || !uri) return null;

  const name = sanitizeDisplayName(value.name || uri, "document");
  const createdAt = asText(value.createdAt) || new Date(0).toISOString();
  return {
    id,
    name,
    uri,
    mimeType: inferVaultMimeType(name, value.mimeType),
    size: Number.isFinite(Number(value.size)) && Number(value.size) >= 0
      ? Number(value.size)
      : null,
    category: VAULT_CATEGORIES.includes(value.category) ? value.category : VAULT_CATEGORIES[0],
    status: VAULT_STATUSES.includes(value.status) ? value.status : VAULT_STATUSES[0],
    note: asText(value.note).slice(0, MAX_VAULT_NOTE_LENGTH),
    createdAt,
    updatedAt: asText(value.updatedAt) || createdAt
  };
}

export function applyVaultPatch(record, changes = {}, now = new Date().toISOString()) {
  const current = normalizeVaultRecord(record);
  if (!current) return null;

  return {
    ...current,
    category: VAULT_CATEGORIES.includes(changes.category) ? changes.category : current.category,
    status: VAULT_STATUSES.includes(changes.status) ? changes.status : current.status,
    note: typeof changes.note === "string"
      ? changes.note.trim().slice(0, MAX_VAULT_NOTE_LENGTH)
      : current.note,
    updatedAt: asText(now) || current.updatedAt
  };
}

export function sortVaultFiles(files) {
  return [...files].sort((left, right) => {
    const rightTime = Date.parse(right?.createdAt || "") || 0;
    const leftTime = Date.parse(left?.createdAt || "") || 0;
    return rightTime - leftTime;
  });
}

export function fileVaultReducer(state, action) {
  const current = Array.isArray(state) ? state : [];

  switch (action?.type) {
    case VAULT_ACTIONS.HYDRATE:
      return sortVaultFiles(Array.isArray(action.files) ? action.files : []);
    case VAULT_ACTIONS.ADD:
      return action.file
        ? sortVaultFiles([action.file, ...current.filter((file) => file.id !== action.file.id)])
        : current;
    case VAULT_ACTIONS.UPDATE:
      return action.file
        ? current.map((file) => file.id === action.file.id ? action.file : file)
        : current;
    case VAULT_ACTIONS.REMOVE:
      return current.filter((file) => file.id !== action.id);
    default:
      return current;
  }
}

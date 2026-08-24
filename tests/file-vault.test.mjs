import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_VAULT_FILE_SIZE_BYTES,
  VAULT_ACTIONS,
  VAULT_CATEGORIES,
  VAULT_STATUSES,
  applyVaultPatch,
  createVaultRecord,
  fileVaultReducer,
  makeStorageFileName,
  normalizeVaultRecord,
  sanitizeDisplayName,
  validateImportAsset
} from "../data/fileVaultModel.mjs";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const pdfAsset = {
  name: "I-797C receipt notice.pdf",
  uri: "file:///cache/I-797C.pdf",
  mimeType: "application/pdf",
  size: 1024
};

test("File Vault exposes the required categories and statuses", () => {
  assert.deepEqual(VAULT_CATEGORIES, ["TPS", "Work Permit", "Travel", "Notices", "Evidence"]);
  assert.deepEqual(VAULT_STATUSES, ["Ready", "Needs review", "Submitted"]);
});

test("import validation accepts PDFs and images with safe MIME fallback", () => {
  const pdf = validateImportAsset(pdfAsset);
  const image = validateImportAsset({
    name: "passport.HEIC",
    uri: "file:///cache/passport.HEIC",
    mimeType: "application/octet-stream",
    size: 3000
  });

  assert.equal(pdf.valid, true);
  assert.equal(pdf.value.mimeType, "application/pdf");
  assert.equal(image.valid, true);
  assert.equal(image.value.mimeType, "image/heic");
});

test("import validation rejects invalid, empty, unsupported, and oversized files", () => {
  assert.equal(validateImportAsset(null).code, "INVALID_ASSET");
  assert.equal(validateImportAsset({ ...pdfAsset, size: 0 }).code, "EMPTY_FILE");
  assert.equal(validateImportAsset({
    name: "notes.txt",
    uri: "file:///cache/notes.txt",
    mimeType: "text/plain",
    size: 20
  }).code, "UNSUPPORTED_TYPE");
  assert.equal(validateImportAsset({
    name: "malware.exe",
    uri: "file:///cache/malware.exe",
    mimeType: "application/octet-stream",
    size: 20
  }).code, "UNSUPPORTED_TYPE");
  assert.equal(validateImportAsset({
    ...pdfAsset,
    size: MAX_VAULT_FILE_SIZE_BYTES + 1
  }).code, "FILE_TOO_LARGE");
});

test("record creation stores only normalized local metadata", () => {
  const record = createVaultRecord(pdfAsset, {
    category: "Notices",
    destinationUri: "file:///documents/file-vault/vault-1.pdf",
    id: "vault-1",
    now: "2026-08-24T10:00:00.000Z"
  });

  assert.deepEqual(record, {
    id: "vault-1",
    name: "I-797C receipt notice.pdf",
    uri: "file:///documents/file-vault/vault-1.pdf",
    mimeType: "application/pdf",
    size: 1024,
    category: "Notices",
    status: "Ready",
    note: "",
    createdAt: "2026-08-24T10:00:00.000Z",
    updatedAt: "2026-08-24T10:00:00.000Z"
  });
  assert.equal(makeStorageFileName("vault-1", record.name), "vault-1.pdf");
});

test("filenames are reduced to safe display and storage names", () => {
  assert.equal(sanitizeDisplayName("C:\\private\\passport\u0000.jpg"), "passport.jpg");
  assert.equal(makeStorageFileName("../../vault 2", "passport.jpg"), "vault2.jpg");
});

test("metadata patches only allow category, status, and private-note changes", () => {
  const record = createVaultRecord(pdfAsset, {
    category: "TPS",
    destinationUri: "file:///documents/vault-1.pdf",
    id: "vault-1",
    now: "2026-08-24T10:00:00.000Z"
  });
  const updated = applyVaultPatch(record, {
    status: "Submitted",
    category: "Evidence",
    note: "  Mailed with tracking.  ",
    uri: "https://example.com/uploaded.pdf",
    name: "changed.pdf"
  }, "2026-08-24T11:00:00.000Z");

  assert.equal(updated.status, "Submitted");
  assert.equal(updated.category, "Evidence");
  assert.equal(updated.note, "Mailed with tracking.");
  assert.equal(updated.uri, record.uri);
  assert.equal(updated.name, record.name);
  assert.equal(updated.updatedAt, "2026-08-24T11:00:00.000Z");
});

test("normalization rejects incomplete records and repairs unknown enum values", () => {
  assert.equal(normalizeVaultRecord({ id: "missing-uri" }), null);
  const normalized = normalizeVaultRecord({
    id: "vault-1",
    name: "receipt.pdf",
    uri: "file:///documents/receipt.pdf",
    category: "Unknown",
    status: "Unknown"
  });

  assert.equal(normalized.category, "TPS");
  assert.equal(normalized.status, "Ready");
});

test("File Vault reducer hydrates, adds, updates, and removes records", () => {
  const older = createVaultRecord(pdfAsset, {
    id: "older",
    destinationUri: "file:///documents/older.pdf",
    now: "2026-08-23T10:00:00.000Z"
  });
  const newer = createVaultRecord(pdfAsset, {
    id: "newer",
    destinationUri: "file:///documents/newer.pdf",
    now: "2026-08-24T10:00:00.000Z"
  });

  let state = fileVaultReducer([], { type: VAULT_ACTIONS.HYDRATE, files: [older, newer] });
  assert.deepEqual(state.map((file) => file.id), ["newer", "older"]);

  const updated = applyVaultPatch(older, { status: "Needs review" });
  state = fileVaultReducer(state, { type: VAULT_ACTIONS.UPDATE, file: updated });
  assert.equal(state.find((file) => file.id === "older").status, "Needs review");

  const third = { ...newer, id: "third", uri: "file:///documents/third.pdf" };
  state = fileVaultReducer(state, { type: VAULT_ACTIONS.ADD, file: third });
  assert.equal(state.filter((file) => file.id === "third").length, 1);

  state = fileVaultReducer(state, { type: VAULT_ACTIONS.REMOVE, id: "newer" });
  assert.equal(state.some((file) => file.id === "newer"), false);
});

test("native import opens the picker URI and verifies its real size before copying", async () => {
  const service = await readProjectFile("data/fileVaultService.js");

  assert.match(service, /new File\(validation\.value\.uri\)/);
  assert.match(service, /source\.info\(\)/);
  assert.match(service, /copiedSize > MAX_VAULT_FILE_SIZE_BYTES/);
  assert.doesNotMatch(service, /new File\(asset\)/);
});

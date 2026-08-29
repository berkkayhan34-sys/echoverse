/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { safeUpdateVersion } = require("./updater-validation.cjs");

const UI_MANIFEST_SCHEMA_VERSION = 2;
const MAX_MANIFEST_BYTES = 1_000_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 1_000;
const DEFAULT_TIMEOUT_MS = 15_000;

function canonicalManifestPayload(manifest) {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    product: manifest.product,
    version: manifest.version,
    webRevision: manifest.webRevision,
    minShellVersion: manifest.minShellVersion,
    entrypoint: manifest.entrypoint,
    files: manifest.files.map((file) => ({
      path: file.path,
      sha512: file.sha512,
      size: file.size
    }))
  });
}

function parseVersion(value) {
  const version = safeUpdateVersion(value);
  if (!version) return null;
  const [core, prerelease = ""] = version.split("-", 2);
  const numbers = core.split(".").map((part) => Number(part));
  if (numbers.some((part) => !Number.isSafeInteger(part))) return null;
  return { version, numbers, prerelease: prerelease.split(".").filter(Boolean) };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] > b.numbers[index] ? 1 : -1;
  }
  if (!a.prerelease.length && !b.prerelease.length) return 0;
  if (!a.prerelease.length) return 1;
  if (!b.prerelease.length) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const av = a.prerelease[index];
    const bv = b.prerelease[index];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    if (av === bv) continue;
    const an = /^\d+$/u.test(av) ? Number(av) : null;
    const bn = /^\d+$/u.test(bv) ? Number(bv) : null;
    if (an !== null && bn !== null) return an > bn ? 1 : -1;
    if (an !== null) return -1;
    if (bn !== null) return 1;
    return av > bv ? 1 : -1;
  }
  return 0;
}

function validRelativePath(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 256) return false;
  if (value.includes("\\") || value.startsWith("/") || value.includes("\0")) return false;
  if (!/^[A-Za-z0-9._/-]+$/u.test(value)) return false;
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized.startsWith("../")) return false;
  return value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function validSha512(value) {
  return typeof value === "string" && /^[a-f0-9]{128}$/u.test(value);
}

function validWebRevision(value) {
  return typeof value === "string" && /^[a-f0-9]{7,64}$/u.test(value);
}

function validateManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.schemaVersion !== UI_MANIFEST_SCHEMA_VERSION || value.product !== "EchoVerse")
    return null;
  const version = parseVersion(value.version);
  const minShellVersion = parseVersion(value.minShellVersion);
  if (
    !version ||
    !minShellVersion ||
    !validWebRevision(value.webRevision) ||
    !validRelativePath(value.entrypoint)
  )
    return null;
  if (!Array.isArray(value.files) || value.files.length < 1 || value.files.length > MAX_FILES)
    return null;

  const seen = new Set();
  const files = [];
  let totalBytes = 0;
  for (const file of value.files) {
    if (!file || typeof file !== "object" || !validRelativePath(file.path)) return null;
    if (seen.has(file.path) || file.path === "ui-manifest.json" || !validSha512(file.sha512))
      return null;
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES)
      return null;
    seen.add(file.path);
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) return null;
    files.push({ path: file.path, sha512: file.sha512, size: file.size });
  }
  if (!seen.has(value.entrypoint)) return null;
  if (
    typeof value.signature !== "string" ||
    value.signature.length < 1 ||
    value.signature.length > 512
  ) {
    return null;
  }
  let signature;
  try {
    signature = Buffer.from(value.signature, "base64");
  } catch {
    return null;
  }
  if (signature.length !== 64) return null;

  return {
    schemaVersion: UI_MANIFEST_SCHEMA_VERSION,
    product: "EchoVerse",
    version: version.version,
    webRevision: value.webRevision,
    minShellVersion: minShellVersion.version,
    entrypoint: value.entrypoint,
    files,
    signature: value.signature
  };
}

function verifyManifestSignature(manifest, publicKeyDerBase64) {
  const validated = validateManifest(manifest);
  if (!validated || typeof publicKeyDerBase64 !== "string") return false;
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyDerBase64, "base64"),
      format: "der",
      type: "spki"
    });
    return crypto.verify(
      null,
      Buffer.from(canonicalManifestPayload(validated), "utf8"),
      publicKey,
      Buffer.from(validated.signature, "base64")
    );
  } catch {
    return false;
  }
}

function ensureWithin(root, candidate) {
  const rootPath = path.resolve(root);
  const candidatePath = path.resolve(candidate);
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${path.sep}`);
}

function uiCacheDirectory(cacheRoot, version, webRevision) {
  return path.join(cacheRoot, `v-${version}-${webRevision}`);
}

function readCachedUi(cacheRoot, shellVersion, publicKeyDerBase64) {
  try {
    const pointerPath = path.join(cacheRoot, "current.json");
    const pointer = JSON.parse(fs.readFileSync(pointerPath, "utf8"));
    const manifestVersion = parseVersion(pointer.version);
    const pointerMinShellVersion = parseVersion(pointer.minShellVersion);
    if (
      !manifestVersion ||
      !validWebRevision(pointer.webRevision) ||
      !validRelativePath(pointer.entrypoint)
    )
      return null;
    if (!pointerMinShellVersion || compareVersions(shellVersion, pointerMinShellVersion) < 0)
      return null;
    const directory = uiCacheDirectory(cacheRoot, manifestVersion.version, pointer.webRevision);
    const manifest = validateManifest(
      JSON.parse(fs.readFileSync(path.join(directory, "ui-manifest.json"), "utf8"))
    );
    if (
      !manifest ||
      manifest.version !== manifestVersion.version ||
      manifest.webRevision !== pointer.webRevision ||
      !verifyManifestSignature(manifest, publicKeyDerBase64)
    )
      return null;
    if (
      manifest.entrypoint !== pointer.entrypoint ||
      manifest.minShellVersion !== pointer.minShellVersion
    )
      return null;
    for (const file of manifest.files) {
      const cachedFile = path.resolve(directory, file.path);
      if (!ensureWithin(directory, cachedFile) || !fs.statSync(cachedFile).isFile()) return null;
      const content = fs.readFileSync(cachedFile);
      if (
        content.length !== file.size ||
        crypto.createHash("sha512").update(content).digest("hex") !== file.sha512
      )
        return null;
    }
    const entrypoint = path.resolve(directory, pointer.entrypoint);
    if (!ensureWithin(directory, entrypoint) || !fs.statSync(entrypoint).isFile()) return null;
    return {
      directory,
      entrypoint,
      version: manifestVersion.version,
      webRevision: manifest.webRevision,
      source: "cache"
    };
  } catch {
    return null;
  }
}

function atomicWrite(filePath, content) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.tmp-${process.pid}-${crypto.randomBytes(8).toString("hex")}`
  );
  fs.writeFileSync(temporary, content, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, filePath);
}

function fetchWithTimeout(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return Promise.resolve(fetchImpl(url, { signal: controller.signal })).finally(() =>
    clearTimeout(timer)
  );
}

async function readResponseBytes(response, maxBytes) {
  if (!response || response.ok !== true || typeof response.arrayBuffer !== "function") {
    throw new Error("UI update response rejected");
  }
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("UI update response too large");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error("UI update response too large");
  return bytes;
}

async function downloadUiUpdate({
  manifestUrl,
  cacheRoot,
  shellVersion,
  publicKeyDerBase64,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  if (typeof manifestUrl !== "string") throw new Error("UI manifest URL missing");
  if (!parseVersion(shellVersion)) throw new Error("Desktop shell version invalid");
  const manifestLocation = new URL(manifestUrl);
  if (manifestLocation.protocol !== "https:") throw new Error("UI manifest must use HTTPS");
  const manifestBytes = await readResponseBytes(
    await fetchWithTimeout(fetchImpl, manifestLocation.toString(), timeoutMs),
    MAX_MANIFEST_BYTES
  );
  let parsed;
  try {
    parsed = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw new Error("UI manifest JSON invalid");
  }
  const manifest = validateManifest(parsed);
  if (!manifest || !verifyManifestSignature(manifest, publicKeyDerBase64)) {
    throw new Error("UI manifest signature invalid");
  }
  if (compareVersions(shellVersion, manifest.minShellVersion) < 0) {
    throw new Error("UI manifest requires a newer desktop shell");
  }

  fs.mkdirSync(cacheRoot, { recursive: true });
  const existing = readCachedUi(cacheRoot, shellVersion, publicKeyDerBase64);
  if (
    existing &&
    existing.version === manifest.version &&
    existing.webRevision === manifest.webRevision
  )
    return existing;

  const staging = fs.mkdtempSync(path.join(cacheRoot, ".staging-"));
  let totalBytes = 0;
  try {
    for (const file of manifest.files) {
      const fileUrl = new URL(file.path, manifestLocation);
      if (fileUrl.origin !== manifestLocation.origin) throw new Error("UI asset origin rejected");
      const fileBytes = await readResponseBytes(
        await fetchWithTimeout(fetchImpl, fileUrl.toString(), timeoutMs),
        Math.min(MAX_FILE_BYTES, file.size + 1)
      );
      if (fileBytes.length !== file.size) throw new Error("UI asset size mismatch");
      const digest = crypto.createHash("sha512").update(fileBytes).digest("hex");
      if (digest !== file.sha512) throw new Error("UI asset hash mismatch");
      totalBytes += fileBytes.length;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error("UI update too large");
      const destination = path.resolve(staging, file.path);
      if (!ensureWithin(staging, destination)) throw new Error("UI asset path rejected");
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, fileBytes, { mode: 0o600 });
    }
    atomicWrite(path.join(staging, "ui-manifest.json"), `${JSON.stringify(manifest)}\n`);
    const destination = uiCacheDirectory(cacheRoot, manifest.version, manifest.webRevision);
    if (!ensureWithin(cacheRoot, destination)) throw new Error("UI cache path rejected");
    if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
    fs.renameSync(staging, destination);
    atomicWrite(
      path.join(cacheRoot, "current.json"),
      JSON.stringify({
        version: manifest.version,
        webRevision: manifest.webRevision,
        minShellVersion: manifest.minShellVersion,
        entrypoint: manifest.entrypoint
      })
    );
    return {
      directory: destination,
      entrypoint: path.join(destination, manifest.entrypoint),
      version: manifest.version,
      webRevision: manifest.webRevision,
      source: "download"
    };
  } finally {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  }
}

async function prepareUiUpdate(options) {
  const cached = readCachedUi(options.cacheRoot, options.shellVersion, options.publicKeyDerBase64);
  try {
    const result = await downloadUiUpdate(options);
    return { ...result, fallback: false };
  } catch (error) {
    if (cached) return { ...cached, fallback: true, error: error.message };
    return {
      directory: options.bundledDirectory,
      entrypoint: path.join(options.bundledDirectory, "index.html"),
      version: null,
      webRevision: null,
      source: "bundled",
      fallback: true,
      error: error.message
    };
  }
}

module.exports = {
  UI_MANIFEST_SCHEMA_VERSION,
  canonicalManifestPayload,
  compareVersions,
  validWebRevision,
  validateManifest,
  verifyManifestSignature,
  readCachedUi,
  downloadUiUpdate,
  prepareUiUpdate
};

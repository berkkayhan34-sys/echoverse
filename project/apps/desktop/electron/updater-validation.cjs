/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

const SAFE_VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const path = require("node:path");
const fs = require("node:fs");

function loadCatalog(locale) {
  const root =
    typeof process.resourcesPath === "string" && process.defaultApp !== true
      ? path.join(process.resourcesPath, "localizations")
      : path.join(__dirname, "..", "..", "..", "packages", "contracts", "src", "localizations");
  try {
    return JSON.parse(fs.readFileSync(path.join(root, `${locale}.json`), "utf8"));
  } catch {
    return {};
  }
}

function safeUpdateVersion(value) {
  if (typeof value !== "string") return null;
  const version = value.trim();
  return version.length <= 64 && SAFE_VERSION_PATTERN.test(version) ? version : null;
}

function safeUpdatePercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 100) return null;
  return Math.round(value);
}

function safeUpdaterFailure(locale = "tr") {
  const selected = locale === "tr" ? loadCatalog("tr") : loadCatalog("en");
  return selected["update.failed"] || "updater_operation_failed";
}

module.exports = { safeUpdateVersion, safeUpdatePercent, safeUpdaterFailure };

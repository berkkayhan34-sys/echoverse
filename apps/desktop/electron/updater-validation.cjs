/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

const SAFE_VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

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

function safeUpdaterFailure() {
  return "Güncelleme işlemi başarısız oldu. Lütfen daha sonra tekrar dene.";
}

module.exports = { safeUpdateVersion, safeUpdatePercent, safeUpdaterFailure };

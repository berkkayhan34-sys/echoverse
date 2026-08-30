/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const args = ["detect", "--source", ".", "--no-banner", "--redact", "--exit-code", "1"];
const candidates = ["gitleaks"];
if (process.platform === "win32" && process.env.LOCALAPPDATA) {
  candidates.push(`${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Links\\gitleaks.exe`);
}

for (const candidate of candidates) {
  if (candidate !== "gitleaks" && !fs.existsSync(candidate)) continue;
  const result = spawnSync(candidate, args, { stdio: "inherit" });
  if (!result.error) {
    process.exitCode = result.status ?? 1;
    break;
  }
}

if (process.exitCode === undefined) {
  console.error("Gitleaks is required; install it with the repository tooling instructions.");
  process.exitCode = 1;
}

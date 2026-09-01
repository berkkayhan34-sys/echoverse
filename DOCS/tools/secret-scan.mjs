/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = ["detect", "--source", ".", "--no-banner", "--redact", "--exit-code", "1"];
const pathEntries = (process.env.PATH || process.env.Path || "")
  .split(path.delimiter)
  .filter(Boolean);

function executableCandidates() {
  const candidates = [];
  if (process.env.GITLEAKS_PATH) candidates.push(process.env.GITLEAKS_PATH);
  for (const directory of pathEntries) {
    candidates.push(
      path.join(directory, process.platform === "win32" ? "gitleaks.exe" : "gitleaks")
    );
    candidates.push(path.join(directory, "gitleaks"));
  }
  if (process.platform === "win32") {
    if (process.env.LOCALAPPDATA) {
      candidates.push(path.join(process.env.LOCALAPPDATA, "EchoVerse", "tools", "gitleaks.exe"));
      candidates.push(
        path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", "gitleaks.exe")
      );
    }
    if (process.env.APPDATA) {
      candidates.push(path.join(process.env.APPDATA, "EchoVerse", "tools", "gitleaks.exe"));
    }
  }
  candidates.push("gitleaks");
  return [...new Set(candidates)];
}

for (const candidate of executableCandidates()) {
  if (path.isAbsolute(candidate) && !fs.existsSync(candidate)) continue;
  const result = spawnSync(candidate, args, { stdio: "inherit" });
  if (!result.error) {
    process.exitCode = result.status ?? 1;
    break;
  }
}

if (process.exitCode === undefined) {
  console.error(
    "Gitleaks is required; install it with the repository tooling instructions or set GITLEAKS_PATH."
  );
  process.exitCode = 1;
}

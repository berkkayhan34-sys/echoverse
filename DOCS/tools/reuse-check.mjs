/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const stagingRoot = path.join(repositoryRoot, "tmp", "reuse-source");

function gitFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: repositoryRoot,
      encoding: "buffer"
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.toString("utf8"));
  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

function stageRepository() {
  fs.rmSync(stagingRoot, { recursive: true, force: true });
  // Keep the staging tree inside tmp while preventing REUSE from discovering
  // the parent repository and walking ignored dependency directories.
  fs.mkdirSync(stagingRoot, { recursive: true });
  const init = spawnSync("git", ["init", "--quiet", stagingRoot], { encoding: "utf8" });
  if (init.status !== 0) throw new Error(init.stderr);
  for (const relativePath of gitFiles()) {
    const source = path.join(repositoryRoot, relativePath);
    if (!fs.existsSync(source)) continue;
    const target = path.join(stagingRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

stageRepository();
const result = spawnSync("reuse", ["lint"], { cwd: stagingRoot, stdio: "inherit" });
if (result.error) {
  console.error("REUSE is required; install it with `brew install reuse`.");
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}

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
// Node does not resolve a .cmd shim when spawning without a shell on Windows.
// Prefer a PATH-installed CLI, then use the pinned Python module so the local
// gate also works on Windows hosts where Python's Scripts directory is not on
// PATH yet.
const reuseOnPath =
  process.platform === "win32"
    ? spawnSync("reuse.cmd", ["--version"], { stdio: "ignore" }).status === 0
    : spawnSync("reuse", ["--version"], { stdio: "ignore" }).status === 0;
const reuseCommand = reuseOnPath
  ? process.platform === "win32"
    ? process.env.ComSpec || "cmd.exe"
    : "reuse"
  : process.platform === "win32"
    ? "py"
    : "reuse";
const reuseArgs = reuseOnPath
  ? process.platform === "win32"
    ? ["/d", "/s", "/c", "reuse.cmd lint"]
    : ["lint"]
  : ["-m", "reuse", "lint"];
const result = spawnSync(reuseCommand, reuseArgs, { cwd: stagingRoot, stdio: "inherit" });
if (result.error) {
  console.error("REUSE is required; install it with the repository tooling instructions.");
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}

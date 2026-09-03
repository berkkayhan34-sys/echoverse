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

function pathEntries() {
  return (process.env.PATH || process.env.Path || "").split(path.delimiter).filter(Boolean);
}

function existingFile(candidate) {
  return candidate && fs.existsSync(candidate) ? candidate : null;
}

function reuseCandidates() {
  const candidates = [];
  if (process.env.REUSE_PATH) candidates.push(process.env.REUSE_PATH);
  for (const directory of pathEntries()) {
    candidates.push(path.join(directory, process.platform === "win32" ? "reuse.exe" : "reuse"));
    if (process.platform === "win32") candidates.push(path.join(directory, "reuse.cmd"));
  }
  if (process.platform === "win32") {
    for (const root of [process.env.APPDATA, process.env.LOCALAPPDATA]) {
      if (!root || !fs.existsSync(root)) continue;
      for (const relative of ["Python", path.join("Programs", "Python")]) {
        const pythonRoot = path.join(root, relative);
        if (!fs.existsSync(pythonRoot)) continue;
        for (const version of fs.readdirSync(pythonRoot, { withFileTypes: true })) {
          if (!version.isDirectory() || !/^Python\d+$/.test(version.name)) continue;
          const scripts = path.join(pythonRoot, version.name, "Scripts");
          candidates.push(path.join(scripts, "reuse.exe"), path.join(scripts, "reuse.cmd"));
        }
      }
    }
  }
  return [...new Set(candidates)];
}

function pythonCandidates() {
  const candidates = [];
  for (const directory of pathEntries()) {
    candidates.push(path.join(directory, process.platform === "win32" ? "python.exe" : "python"));
    candidates.push(path.join(directory, process.platform === "win32" ? "python3.exe" : "python3"));
  }
  if (process.platform === "win32") candidates.push("py", "python", "python3");
  return [...new Set(candidates)];
}

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
const directReuse = reuseCandidates().map(existingFile).find(Boolean);
let reuseCommand = directReuse;
let reuseArgs = ["lint"];
if (directReuse?.toLowerCase().endsWith(".cmd")) {
  reuseCommand = process.env.ComSpec || "cmd.exe";
  const quoted = `"${directReuse.replaceAll('"', '""')}"`;
  reuseArgs = ["/d", "/s", "/c", `${quoted} lint`];
}
if (!reuseCommand) {
  const python = pythonCandidates().find((candidate) => {
    if (path.isAbsolute(candidate)) return fs.existsSync(candidate);
    return spawnSync(candidate, ["--version"], { stdio: "ignore" }).status === 0;
  });
  if (python) {
    reuseCommand = python;
    reuseArgs = ["-m", "reuse", "lint"];
  }
}
if (!reuseCommand) {
  console.error(
    "REUSE is required; install it with the repository tooling instructions or set REUSE_PATH."
  );
  process.exitCode = 1;
  process.exit();
}
const result = spawnSync(reuseCommand, reuseArgs, { cwd: stagingRoot, stdio: "inherit" });
if (result.error) {
  console.error(
    "REUSE is required; install it with the repository tooling instructions or set REUSE_PATH."
  );
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}

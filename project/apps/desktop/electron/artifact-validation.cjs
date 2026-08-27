/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function fail(message) {
  throw new Error(`[artifact-validation:${message}]`);
}

function requireFile(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`missing:${file}`);
}

function sha512Base64(file) {
  return crypto.createHash("sha512").update(fs.readFileSync(file)).digest("base64");
}

function metadataEntry(metadata, filename) {
  const marker = `url: ${filename}`;
  const start = metadata.indexOf(marker);
  if (start < 0) fail(`metadata-file:${filename}`);
  const next = metadata.indexOf("\n  - url:", start + marker.length);
  const section = metadata.slice(start, next < 0 ? metadata.length : next);
  const sha512 = section.match(/\n {4}sha512: (\S+)/)?.[1];
  const size = Number(section.match(/\n {4}size: (\d+)/)?.[1]);
  if (!sha512 || !Number.isSafeInteger(size)) fail(`metadata-entry:${filename}`);
  return { sha512, size };
}

function validateArtifact(target, arch, outputDirectory, version) {
  const normalizedTarget = target === "win" ? "win" : "mac";
  const metadataName = normalizedTarget === "win" ? "latest.yml" : "latest-mac.yml";
  const files =
    normalizedTarget === "win"
      ? [`EchoVerse-Setup-${version}.exe`]
      : [`EchoVerse-${version}-${arch}.zip`, `EchoVerse-${version}-${arch}.dmg`];
  const metadataPath = path.join(outputDirectory, metadataName);
  requireFile(metadataPath);
  const metadata = fs.readFileSync(metadataPath, "utf8");
  if (!new RegExp(`^version: ${version.replaceAll(".", "\\.")}\\s*$`, "m").test(metadata)) {
    fail(`metadata-version:${metadataName}`);
  }

  for (const filename of files) {
    const artifact = path.join(outputDirectory, filename);
    const blockmap = `${artifact}.blockmap`;
    requireFile(artifact);
    requireFile(blockmap);
    const entry = metadataEntry(metadata, filename);
    if (entry.sha512 !== sha512Base64(artifact)) fail(`checksum:${filename}`);
    if (entry.size !== fs.statSync(artifact).size) fail(`size:${filename}`);
    try {
      const compressed = fs.readFileSync(blockmap);
      const blockmapContents =
        compressed[0] === 0x1f && compressed[1] === 0x8b
          ? zlib.gunzipSync(compressed).toString("utf8")
          : compressed.toString("utf8");
      const parsedBlockmap = JSON.parse(blockmapContents);
      if (!Array.isArray(parsedBlockmap.files) || parsedBlockmap.files.length === 0) {
        fail(`blockmap:${filename}`);
      }
    } catch (error) {
      fail(`blockmap:${filename}:${error instanceof Error ? error.message : "invalid"}`);
    }
  }

  console.log(`Validated ${normalizedTarget} ${arch} artifacts for v${version}`);
}

const version = argument(
  "version",
  fs.readFileSync(path.resolve(__dirname, "../../../../VERSION"), "utf8").trim()
);
const target = argument("target", process.env.EV_TARGET || "mac");
const arch = argument("arch", process.env.EV_ARCH || (target === "win" ? "x64" : "arm64"));
const outputDirectory = path.resolve(
  argument("dir", process.env.EV_OUTPUT_DIR || "../../../tmp/release/desktop")
);

if (!/^\d+\.\d+\.\d+$/.test(version)) fail("version");
if (!/^(?:win|mac)$/.test(target)) fail("target");
if (!/^(?:x64|arm64)$/.test(arch)) fail("arch");
validateArtifact(target, arch, outputDirectory, version);

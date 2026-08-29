/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const outputDirectory = path.resolve(
  repositoryRoot,
  process.env.ECHO_VERSE_WEB_OUTPUT || "tmp/generated/web"
);
const version = fs.readFileSync(path.join(repositoryRoot, "VERSION"), "utf8").trim();
const signingKey = process.env.ECHO_VERSE_UI_SIGNING_KEY;
const webRevision = process.env.ECHO_VERSE_WEB_REVISION || process.env.GITHUB_SHA;
const minShellVersion = process.env.ECHO_VERSE_UI_MIN_SHELL_VERSION || "1.8.4";

if (!signingKey)
  throw new Error("ECHO_VERSE_UI_SIGNING_KEY is required to publish the UI manifest");
if (!webRevision || !/^[a-f0-9]{7,64}$/u.test(webRevision)) {
  throw new Error("ECHO_VERSE_WEB_REVISION or GITHUB_SHA must be a Git commit SHA");
}
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(version)) {
  throw new Error(`Invalid canonical product version: ${version}`);
}
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(minShellVersion)) {
  throw new Error(`Invalid minimum shell version: ${minShellVersion}`);
}

function collectFiles(directory, prefix = "") {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(absolute, relative);
      if (!entry.isFile() || relative === "ui-manifest.json") return [];
      return [relative.replaceAll(path.sep, "/")];
    })
    .sort();
}

const files = collectFiles(outputDirectory).map((relativePath) => {
  const content = fs.readFileSync(path.join(outputDirectory, relativePath));
  return {
    path: relativePath,
    sha512: crypto.createHash("sha512").update(content).digest("hex"),
    size: content.length
  };
});

if (!files.some((file) => file.path === "index.html")) {
  throw new Error("Built web UI is missing index.html");
}

const unsignedManifest = {
  schemaVersion: 2,
  product: "EchoVerse",
  version,
  webRevision,
  minShellVersion,
  entrypoint: "index.html",
  files
};
const payload = JSON.stringify(unsignedManifest);
const signature = crypto.sign(null, Buffer.from(payload, "utf8"), signingKey).toString("base64");
const manifest = { ...unsignedManifest, signature };
fs.writeFileSync(
  path.join(outputDirectory, "ui-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);
console.log(`Signed EchoVerse UI manifest ${version} web=${webRevision} (${files.length} files)`);

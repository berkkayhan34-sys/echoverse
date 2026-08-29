/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  canonicalManifestPayload,
  prepareUiUpdate,
  validateManifest,
  verifyManifestSignature
} = require("./ui-update.cjs");

function response(content: Buffer) {
  return {
    ok: true,
    headers: { get: (name: string) => (name === "content-length" ? String(content.length) : null) },
    arrayBuffer: async () => content
  };
}

function signedManifest(
  files: Array<{ path: string; content: Buffer }>,
  webRevision = "a".repeat(40)
) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  const unsigned = {
    schemaVersion: 2,
    product: "EchoVerse",
    version: "1.8.4",
    webRevision,
    minShellVersion: "1.8.4",
    entrypoint: "index.html",
    files: files.map((file) => ({
      path: file.path,
      sha512: crypto.createHash("sha512").update(file.content).digest("hex"),
      size: file.content.length
    }))
  };
  const signature = crypto
    .sign(null, Buffer.from(canonicalManifestPayload(unsigned)), privateKey)
    .toString("base64");
  return {
    manifest: { ...unsigned, signature },
    publicKey: publicKey.toString("base64"),
    privateKey
  };
}

describe("desktop UI update boundary", () => {
  it("accepts only signed, bounded manifests", () => {
    const files = [
      { path: "index.html", content: Buffer.from("<script src='./assets/app.js'></script>") },
      { path: "assets/app.js", content: Buffer.from("console.log('ok')") }
    ];
    const { manifest, publicKey } = signedManifest(files);

    expect(validateManifest(manifest)).not.toBeNull();
    expect(validateManifest({ ...manifest, webRevision: "not-a-commit" })).toBeNull();
    expect(verifyManifestSignature(manifest, publicKey)).toBe(true);
    expect(verifyManifestSignature({ ...manifest, version: "9.9.9" }, publicKey)).toBe(false);
    expect(
      validateManifest({ ...manifest, files: [{ ...manifest.files[0], path: "../escape" }] })
    ).toBeNull();
  });

  it("downloads verified files atomically and falls back to the bundled UI on failure", async () => {
    const files = [
      { path: "index.html", content: Buffer.from("<main>cached UI</main>") },
      { path: "assets/app.js", content: Buffer.from("console.log('cached')") }
    ];
    const { manifest, publicKey } = signedManifest(files);
    const manifestUrl = "https://ui.example.test/echoverse/ui-manifest.json";
    const payloads = new Map<string, Buffer>([
      [manifestUrl, Buffer.from(JSON.stringify(manifest))],
      ...files.map((file) => [new URL(file.path, manifestUrl).toString(), file.content] as const)
    ]);
    const fetchImpl = async (url: string) => response(payloads.get(url) || Buffer.from("missing"));
    const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "echoverse-ui-test-"));
    try {
      const downloaded = await prepareUiUpdate({
        manifestUrl,
        cacheRoot,
        shellVersion: "1.8.4",
        publicKeyDerBase64: publicKey,
        bundledDirectory: "bundled",
        fetchImpl
      });
      expect(downloaded.source).toBe("download");
      expect(downloaded.version).toBe("1.8.4");
      expect(fs.readFileSync(downloaded.entrypoint, "utf8")).toContain("cached UI");

      payloads.set(
        manifestUrl,
        Buffer.from(JSON.stringify({ ...manifest, signature: "A".repeat(88) }))
      );
      const failed = await prepareUiUpdate({
        manifestUrl,
        cacheRoot,
        shellVersion: "1.8.4",
        publicKeyDerBase64: publicKey,
        bundledDirectory: "bundled",
        fetchImpl
      });
      expect(failed.source).toBe("cache");
      expect(failed.fallback).toBe(true);
      expect(failed.version).toBe("1.8.4");

      const emptyCacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "echoverse-ui-empty-"));
      try {
        const bundledFallback = await prepareUiUpdate({
          manifestUrl,
          cacheRoot: emptyCacheRoot,
          shellVersion: "1.8.4",
          publicKeyDerBase64: publicKey,
          bundledDirectory: "bundled",
          fetchImpl
        });
        expect(bundledFallback.source).toBe("bundled");
        expect(bundledFallback.fallback).toBe(true);
      } finally {
        fs.rmSync(emptyCacheRoot, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("uses the web commit revision as part of cache identity", async () => {
    const files = [{ path: "index.html", content: Buffer.from("<main>revisioned</main>") }];
    const first = signedManifest(files, "a".repeat(40));
    const secondRevision = "b".repeat(40);
    const manifestUrl = "https://ui.example.test/echoverse/ui-manifest.json";
    let active = first;
    const payloads = new Map<string, Buffer>([
      ...files.map((file) => [new URL(file.path, manifestUrl).toString(), file.content] as const)
    ]);
    const fetchImpl = async (url: string) =>
      response(
        url === manifestUrl
          ? Buffer.from(JSON.stringify(active.manifest))
          : payloads.get(url) || Buffer.from("missing")
      );
    const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "echoverse-ui-revision-"));
    try {
      const initial = await prepareUiUpdate({
        manifestUrl,
        cacheRoot,
        shellVersion: "1.8.4",
        publicKeyDerBase64: first.publicKey,
        bundledDirectory: "bundled",
        fetchImpl
      });
      expect(initial.source).toBe("download");
      const secondUnsigned = { ...first.manifest, webRevision: secondRevision };
      const secondSignature = crypto
        .sign(null, Buffer.from(canonicalManifestPayload(secondUnsigned)), first.privateKey)
        .toString("base64");
      active = {
        manifest: { ...secondUnsigned, signature: secondSignature },
        publicKey: first.publicKey
      };
      const revisionChanged = await prepareUiUpdate({
        manifestUrl,
        cacheRoot,
        shellVersion: "1.8.4",
        publicKeyDerBase64: first.publicKey,
        bundledDirectory: "bundled",
        fetchImpl
      });
      expect(revisionChanged.source).toBe("download");
      expect(revisionChanged.fallback).toBe(false);
      expect(revisionChanged.webRevision).toBe(secondRevision);
    } finally {
      fs.rmSync(cacheRoot, { recursive: true, force: true });
    }
  });
});

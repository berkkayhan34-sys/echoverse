/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  safeUpdatePercent,
  safeUpdateVersion,
  safeUpdaterFailure,
  updaterFailureState,
  waitForUpdateDownloaded
} = require("./updater-validation.cjs");

describe("updater boundary validation", () => {
  it("accepts bounded semantic versions and rejects metadata injection", () => {
    expect(safeUpdateVersion("1.2.3")).toBe("1.2.3");
    expect(safeUpdateVersion("1.2.3-beta.1+build.4")).toBe("1.2.3-beta.1+build.4");
    expect(safeUpdateVersion("1.2.3\nmalicious")).toBeNull();
    expect(safeUpdateVersion("v1.2.3")).toBeNull();
    expect(safeUpdateVersion("1.2")).toBeNull();
  });

  it("accepts only finite progress values within the renderer contract", () => {
    expect(safeUpdatePercent(42.4)).toBe(42);
    expect(safeUpdatePercent(0)).toBe(0);
    expect(safeUpdatePercent(100)).toBe(100);
    expect(safeUpdatePercent(Number.NaN)).toBeNull();
    expect(safeUpdatePercent(101)).toBeNull();
  });

  it("provides a localized, stable non-sensitive failure message", () => {
    expect(safeUpdaterFailure()).toBe("Güncelleme kontrolü başarısız.");
    expect(safeUpdaterFailure("en")).toBe("Update check failed.");
    expect(safeUpdaterFailure("tr-TR")).toBe("Güncelleme kontrolü başarısız.");
    expect(safeUpdaterFailure("trick")).toBe("Update check failed.");
  });

  it("keeps the known-good version while rolling updater state back to a visible error", () => {
    expect(updaterFailureState("1.7.5", "en")).toEqual({
      phase: "error",
      status: "Update check failed.",
      version: "1.7.5",
      percent: 0,
      error: "Update check failed."
    });
    expect(updaterFailureState("1.7.5\nmalicious", "en").version).toBeNull();
  });

  it("waits for a verified updater download and cleans up listeners", async () => {
    const emitter = new EventEmitter();
    const download = waitForUpdateDownloaded(emitter, 100);
    const info = { version: "1.8.1", downloadedFile: "update.exe" };
    emitter.emit("update-downloaded", info);

    await expect(download).resolves.toEqual(info);
    expect(emitter.listenerCount("update-downloaded")).toBe(0);
    expect(emitter.listenerCount("error")).toBe(0);
  });

  it("fails closed when the updater download errors or times out", async () => {
    const failed = new EventEmitter();
    const failedDownload = waitForUpdateDownloaded(failed, 100);
    failed.emit("error", new Error("network failure"));
    await expect(failedDownload).rejects.toThrow("network failure");

    const timedOut = new EventEmitter();
    await expect(waitForUpdateDownloaded(timedOut, 1)).rejects.toThrow("timed out");
  });
});

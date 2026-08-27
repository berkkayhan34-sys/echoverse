/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createEchoVerseBridge } = require("./bridge.cjs");

describe("Electron preload bridge", () => {
  it("exposes only the approved browser-safe surface and fixed IPC channels", async () => {
    const ipcRenderer = {
      invoke: vi.fn().mockResolvedValue({ ok: true }),
      on: vi.fn(),
      removeListener: vi.fn()
    };
    const bridge = createEchoVerseBridge(ipcRenderer);

    expect(Object.keys(bridge)).toEqual([
      "setLocale",
      "getConfig",
      "authSession",
      "onUpdateStatus",
      "onUpdateState",
      "getUpdateState",
      "installUpdate",
      "getUpdaterLogPath",
      "spotifyStatus",
      "spotifyLogin",
      "spotifyLogout",
      "spotifyPlayback",
      "spotifyApplySync",
      "screenPermission",
      "listScreenSources",
      "selectScreenSource",
      "openScreenSettings",
      "checkForUpdates",
      "getVersion",
      "notify"
    ]);
    expect((bridge as { ipcRenderer?: unknown }).ipcRenderer).toBeUndefined();

    await bridge.setLocale("tr");
    await bridge.authSession.clear();
    await bridge.selectScreenSource("screen-1");
    await bridge.notify({ title: "title", body: "body" });

    expect(ipcRenderer.invoke).toHaveBeenCalledWith("echoverse:set-locale", "tr");
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("auth:clear-session");
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("capture:selectSource", "screen-1");
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("echoverse:notify", {
      title: "title",
      body: "body"
    });
  });

  it("returns unsubscribe functions that remove the exact listener", () => {
    const ipcRenderer = {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn()
    };
    const callback = vi.fn();
    const bridge = createEchoVerseBridge(ipcRenderer);

    const unsubscribe = bridge.onUpdateState(callback);
    const listener = ipcRenderer.on.mock.calls[0]?.[1];
    listener({}, { phase: "ready" });
    unsubscribe();

    expect(callback).toHaveBeenCalledWith({ phase: "ready" });
    expect(ipcRenderer.on).toHaveBeenCalledWith("echoverse:update-state", listener);
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith("echoverse:update-state", listener);
  });
});

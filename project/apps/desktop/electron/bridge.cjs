/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Builds the deliberately small renderer API. Keeping this factory separate
 * makes the context-isolation contract testable without starting Electron.
 */
function createEchoVerseBridge(ipcRenderer) {
  return {
    isDesktop: true,
    setLocale: (locale) => ipcRenderer.invoke("echoverse:set-locale", locale),
    getConfig: () => ipcRenderer.invoke("echoverse:getConfig"),
    authSession: {
      get: () => ipcRenderer.invoke("auth:get-session"),
      set: (value) => ipcRenderer.invoke("auth:set-session", value),
      clear: () => ipcRenderer.invoke("auth:clear-session")
    },

    onUpdateStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("echoverse:update-status", listener);
      return () => ipcRenderer.removeListener("echoverse:update-status", listener);
    },

    onUpdateState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("echoverse:update-state", listener);
      return () => ipcRenderer.removeListener("echoverse:update-state", listener);
    },

    getUpdateState: () => ipcRenderer.invoke("update:get-state"),
    installUpdate: () => ipcRenderer.invoke("update:install"),
    getUpdaterLogPath: () => ipcRenderer.invoke("update:get-log-path"),

    screenPermission: () => ipcRenderer.invoke("capture:screenPermission"),
    listScreenSources: () => ipcRenderer.invoke("capture:listSources"),
    selectScreenSource: (sourceId) => ipcRenderer.invoke("capture:selectSource", sourceId),
    openScreenSettings: () => ipcRenderer.invoke("capture:openScreenSettings"),
    checkForUpdates: () => ipcRenderer.invoke("update:check"),
    getVersion: () => ipcRenderer.invoke("echoverse:getVersion"),
    getUiVersion: () => ipcRenderer.invoke("ui:get-version"),
    notify: (payload) => ipcRenderer.invoke("echoverse:notify", payload),
    copyText: (value) => ipcRenderer.invoke("clipboard:write", value)
  };
}

module.exports = { createEchoVerseBridge };

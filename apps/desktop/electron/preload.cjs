const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("echoverse", {
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

  spotifyStatus: () => ipcRenderer.invoke("spotify:status"),
  spotifyLogin: () => ipcRenderer.invoke("spotify:login"),
  spotifyLogout: () => ipcRenderer.invoke("spotify:logout"),
  spotifyPlayback: () => ipcRenderer.invoke("spotify:playback"),
  spotifyApplySync: (state) => ipcRenderer.invoke("spotify:applySync", state),

  screenPermission: () => ipcRenderer.invoke("capture:screenPermission"),
  listScreenSources: () => ipcRenderer.invoke("capture:listSources"),
  selectScreenSource: (sourceId) => ipcRenderer.invoke("capture:selectSource", sourceId),
  openScreenSettings: () => ipcRenderer.invoke("capture:openScreenSettings"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  getVersion: () => ipcRenderer.invoke("echoverse:getVersion"),
  notify: (payload) => ipcRenderer.invoke("echoverse:notify", payload)
});

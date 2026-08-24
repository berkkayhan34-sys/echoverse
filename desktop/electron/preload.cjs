const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("echoverse", {
  getConfig: () => ipcRenderer.invoke("echoverse:getConfig"),

  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("echoverse:update-status", listener);
  },

  spotifyStatus: () => ipcRenderer.invoke("spotify:status"),
  spotifyLogin: () => ipcRenderer.invoke("spotify:login"),
  spotifyLogout: () => ipcRenderer.invoke("spotify:logout"),
  spotifyPlayback: () => ipcRenderer.invoke("spotify:playback"),
  spotifyApplySync: (state) => ipcRenderer.invoke("spotify:applySync", state)
});

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("echoverse", {
  getConfig: () => ipcRenderer.invoke("echoverse:getConfig")
});

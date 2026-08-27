const { contextBridge, ipcRenderer } = require("electron");
const { createEchoVerseBridge } = require("./bridge.cjs");

contextBridge.exposeInMainWorld("echoverse", createEchoVerseBridge(ipcRenderer));

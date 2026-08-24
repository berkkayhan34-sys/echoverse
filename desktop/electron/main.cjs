const { app, BrowserWindow, ipcMain, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");

let mainWindow = null;

function getConfigPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "config.json");
  }
  return path.join(__dirname, "..", "config.json");
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
  } catch {
    return { serverUrl: "http://localhost:3001" };
  }
}

ipcMain.handle("echoverse:getConfig", () => readConfig());

function sendUpdateStatus(status) {
  mainWindow?.webContents.send("echoverse:update-status", status);
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus("Güncelleme kontrol ediliyor…");
  });

  autoUpdater.on("update-available", info => {
    sendUpdateStatus(`Yeni sürüm ${info.version} indiriliyor…`);
  });

  autoUpdater.on("update-not-available", () => {
    sendUpdateStatus("");
  });

  autoUpdater.on("download-progress", progress => {
    sendUpdateStatus(`Güncelleme indiriliyor… %${Math.round(progress.percent)}`);
  });

  autoUpdater.on("update-downloaded", info => {
    sendUpdateStatus(`EchoVerse ${info.version} hazır. Yeniden başlatılıyor…`);
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 1800);
  });

  autoUpdater.on("error", err => {
    console.error("Auto update error:", err);
    sendUpdateStatus("");
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error("Update check failed:", err);
    });
  }, 2500);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1450,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#101218",
    title: "EchoVerse",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["media", "display-capture"].includes(permission));
  });

  if (process.argv.includes("--dev")) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.once("did-finish-load", setupAutoUpdater);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

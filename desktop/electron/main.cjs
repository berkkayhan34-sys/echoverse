const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const fs = require("fs");

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

function createWindow() {
  const win = new BrowserWindow({
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
    const allowed = [
      "media",
      "display-capture"
    ];
    callback(allowed.includes(permission));
  });

  if (process.argv.includes("--dev")) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

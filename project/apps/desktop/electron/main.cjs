const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  desktopCapturer,
  shell,
  safeStorage,
  systemPreferences,
  Tray,
  Menu,
  nativeImage,
  Notification,
  clipboard
} = require("electron");
const { autoUpdater } = require("electron-updater");
const {
  safeUpdatePercent,
  safeUpdateVersion,
  safeUpdaterFailure: safeUpdaterFailureCatalog,
  updaterFailureState,
  waitForUpdateDownloaded
} = require("./updater-validation.cjs");
const { prepareUiUpdate } = require("./ui-update.cjs");
const { publicKeyDerBase64: uiSigningPublicKey } = require("./ui-signing-public.cjs");
const path = require("path");
const fs = require("fs");

function localizationRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "localizations")
    : path.join(__dirname, "..", "..", "..", "packages", "contracts", "src", "localizations");
}

function loadLocalization(locale) {
  try {
    return JSON.parse(fs.readFileSync(path.join(localizationRoot(), `${locale}.json`), "utf8"));
  } catch {
    return {};
  }
}

const desktopCatalogs = { en: loadLocalization("en"), tr: loadLocalization("tr") };
let desktopLocale = "tr";

function resolveDesktopLocale(value) {
  if (typeof value !== "string") return "en";
  const language = value.trim().toLowerCase().split(/[-_]/u, 1)[0];
  return language === "tr" ? "tr" : "en";
}

function setDesktopLocale(value) {
  const nextLocale = resolveDesktopLocale(value);
  if (nextLocale === desktopLocale) return;
  desktopLocale = nextLocale;
  if (tray) {
    tray.destroy();
    tray = null;
    createTray();
  }
}

function translate(key, values = {}) {
  const message = desktopCatalogs[desktopLocale][key] || desktopCatalogs.en[key] || `[${key}]`;
  return message.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder
  );
}

function safeUpdaterFailure() {
  return safeUpdaterFailureCatalog(desktopLocale);
}

function updaterFailureStateForCurrentVersion() {
  return updaterFailureState(app.getVersion(), desktopLocale);
}

let mainWindow = null;
let splashWindow = null;
let tray = null;
const brandingRoot = app.isPackaged
  ? path.join(process.resourcesPath, "branding")
  : path.join(__dirname, "..", "assets");
const brandingIcon = path.join(brandingRoot, "echoverse-icon.png");
const brandingIco = path.join(brandingRoot, "echoverse.ico");
const splashImage = path.join(brandingRoot, "echoverse-splash.png");
let isQuitting = false;
let selectedDisplaySourceId = null;
let updaterSetupDone = false;
let updateInstallRequested = false;
// Startup updates are best-effort. A slow or unavailable release service must
// never make a healthy bundled application appear to do nothing.
const STARTUP_UPDATE_TIMEOUT_MS = 30_000;
let updaterState = {
  phase: "idle",
  status: "",
  version: null,
  percent: 0,
  error: null
};
let activeUi = {
  directory: null,
  entrypoint: null,
  version: null,
  webRevision: null,
  source: "bundled"
};

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
    return {
      serverUrl: "http://localhost:3001",
      uiUpdate: { enabled: false, manifestUrl: "" }
    };
  }
}

function authSessionPath() {
  return path.join(app.getPath("userData"), "auth-session.bin");
}

function validAuthSession(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.accessToken === "string" &&
    value.accessToken.length > 0 &&
    typeof value.refreshToken === "string" &&
    value.refreshToken.length > 0 &&
    value.account &&
    typeof value.account.id === "string" &&
    typeof value.account.email === "string" &&
    typeof value.account.username === "string"
  );
}

function loadAuthSession() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    if (!fs.existsSync(authSessionPath())) return null;
    const encrypted = fs.readFileSync(authSessionPath());
    const value = JSON.parse(safeStorage.decryptString(encrypted));
    return validAuthSession(value) ? value : null;
  } catch {
    return null;
  }
}

function saveAuthSession(value) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(translate("desktop.secureStorageUnavailable"));
  }
  if (!validAuthSession(value)) throw new Error(translate("desktop.invalidAuthSession"));
  const encrypted = safeStorage.encryptString(JSON.stringify(value));
  fs.mkdirSync(path.dirname(authSessionPath()), { recursive: true });
  fs.writeFileSync(authSessionPath(), encrypted, { mode: 0o600 });
  return { ok: true };
}

function clearAuthSession() {
  try {
    if (fs.existsSync(authSessionPath())) fs.unlinkSync(authSessionPath());
  } catch {}
  return { ok: true };
}

function removeLegacyIntegrationData() {
  // Spotify Together was removed in 1.8.5. Delete only its former encrypted
  // refresh-token file so an obsolete credential is not retained locally.
  try {
    fs.rmSync(path.join(app.getPath("userData"), "spotify-token.bin"), { force: true });
  } catch {}
}

ipcMain.handle("echoverse:getConfig", () => readConfig());
ipcMain.handle("echoverse:set-locale", (_evt, locale) => {
  setDesktopLocale(locale);
  return { ok: true };
});

ipcMain.handle("auth:get-session", () => loadAuthSession());
ipcMain.handle("auth:set-session", (_evt, value) => saveAuthSession(value));
ipcMain.handle("auth:clear-session", () => clearAuthSession());

ipcMain.handle("clipboard:write", (_evt, value) => {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    return { ok: false };
  }
  clipboard.writeText(value);
  return { ok: true };
});

ipcMain.handle("echoverse:notify", (_evt, payload) => {
  try {
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.title !== "string" ||
      typeof payload.body !== "string" ||
      payload.title.length > 200 ||
      payload.body.length > 1000 ||
      (payload.icon !== undefined && payload.icon !== null && typeof payload.icon !== "string") ||
      (typeof payload.icon === "string" && payload.icon.length > 700_000)
    ) {
      return { ok: false, error: translate("desktop.notificationInvalid") };
    }
    const { title, body } = payload;
    const icon =
      typeof payload.icon === "string" &&
      /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(payload.icon)
        ? nativeImage.createFromDataURL(payload.icon)
        : nativeImage.createFromPath(brandingIcon);
    if (Notification.isSupported()) {
      new Notification({
        title: title.trim() || "EchoVerse",
        body: body.trim(),
        icon: icon.isEmpty() ? nativeImage.createFromPath(brandingIcon) : icon,
        silent: false
      }).show();
    }
  } catch {}
  return { ok: true };
});

ipcMain.handle("capture:screenPermission", () => {
  if (process.platform !== "darwin") return "granted";
  try {
    return systemPreferences.getMediaAccessStatus("screen");
  } catch {
    return "unknown";
  }
});

ipcMain.handle("capture:listSources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail && !source.thumbnail.isEmpty() ? source.thumbnail.toDataURL() : "",
    appIcon: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : ""
  }));
});

ipcMain.handle("capture:selectSource", (_evt, sourceId) => {
  if (typeof sourceId !== "string" || sourceId.length < 1 || sourceId.length > 256) {
    return { ok: false, error: translate("desktop.screenSourceInvalid") };
  }
  selectedDisplaySourceId = sourceId;
  return { ok: true };
});

ipcMain.handle("capture:openScreenSettings", async () => {
  if (process.platform === "darwin") {
    await shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    );
  }
  return { ok: true };
});

ipcMain.handle("echoverse:getVersion", () => app.getVersion());
ipcMain.handle("ui:get-version", () => activeUi.webRevision);

function updaterLogPath() {
  try {
    return path.join(app.getPath("userData"), "echoverse-updater.log");
  } catch {
    return null;
  }
}

function logUpdater(message, extra = "") {
  const line = `[${new Date().toISOString()}] ${message}${extra ? ` ${extra}` : ""}\n`;
  console.log("[Updater]", message, extra);

  try {
    const file = updaterLogPath();
    if (file) fs.appendFileSync(file, line, "utf8");
  } catch {}
}

function sendUpdateState(patch = {}) {
  updaterState = {
    ...updaterState,
    ...patch
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("echoverse:update-state", updaterState);
    mainWindow.webContents.send("echoverse:update-status", updaterState.status || "");
  }
}

function showUpdateNotification(title, body) {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  } catch {}
}

async function runUpdateCheck(source = "automatic") {
  if (!app.isPackaged) {
    return { ok: false, error: translate("desktop.updaterInstalledOnly") };
  }

  try {
    const currentVersion = safeUpdateVersion(app.getVersion());
    if (!currentVersion || !["automatic", "manual", "startup"].includes(source)) {
      logUpdater("update_check_rejected");
      sendUpdateState(updaterFailureStateForCurrentVersion());
      return { ok: false, error: safeUpdaterFailure() };
    }
    logUpdater("checking_for_updates", `source=${source} current=${currentVersion}`);
    const result = await autoUpdater.checkForUpdates();
    const version = result?.updateInfo?.version
      ? safeUpdateVersion(result.updateInfo.version)
      : null;
    if (result?.updateInfo?.version && !version) {
      logUpdater("update_metadata_rejected");
      sendUpdateState(updaterFailureStateForCurrentVersion());
      return { ok: false, error: safeUpdaterFailure() };
    }

    return {
      ok: true,
      version,
      available: result?.isUpdateAvailable === true,
      downloadPromise: result?.downloadPromise || null
    };
  } catch {
    logUpdater("update_check_failed");
    sendUpdateState(updaterFailureStateForCurrentVersion());

    return { ok: false, error: safeUpdaterFailure() };
  }
}

async function runStartupUpdateGate() {
  if (!app.isPackaged) return { ok: true, installing: false };

  let timeoutHandle = null;
  try {
    const result = await Promise.race([
      (async () => {
        const check = await runUpdateCheck("startup");
        if (!check.ok || !check.available) return { ...check, installing: false };

        if (check.downloadPromise && typeof check.downloadPromise.then === "function") {
          await check.downloadPromise;
        } else {
          await waitForUpdateDownloaded(autoUpdater, STARTUP_UPDATE_TIMEOUT_MS);
        }

        return { ...check, downloaded: true, installing: false };
      })(),
      new Promise((resolve) => {
        timeoutHandle = setTimeout(() => {
          logUpdater("startup_update_timeout");
          resolve({ ok: false, timeout: true, installing: false });
        }, STARTUP_UPDATE_TIMEOUT_MS);
      })
    ]);

    if (result?.ok && result.downloaded) {
      return { ...result, installing: installUpdateSilently("startup") };
    }
    return result || { ok: false, installing: false };
  } catch {
    logUpdater("startup_update_gate_failed");
    sendUpdateState(updaterFailureStateForCurrentVersion());
    return { ok: false, installing: false };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function installUpdateSilently(source = "automatic") {
  if (!app.isPackaged || updaterState.phase !== "ready") return false;
  if (updateInstallRequested) return true;

  updateInstallRequested = true;
  isQuitting = true;
  logUpdater("silent_quit_and_install", `source=${source}`);

  try {
    // electron-updater forwards the downloaded package's isAdminRightsRequired
    // metadata, so the existing per-user/per-machine scope is preserved. The
    // silent flag suppresses the NSIS installer UI on Windows.
    autoUpdater.quitAndInstall(true, true);
    return true;
  } catch {
    updateInstallRequested = false;
    sendUpdateState(updaterFailureStateForCurrentVersion());
    return false;
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged || updaterSetupDone) return;
  updaterSetupDone = true;

  // GitHub Releases is configured by build.publish in package.json. Download
  // and install are both unattended; startup waits for this package before the
  // main window is created.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    logUpdater("checking_for_update");
    sendUpdateState({
      phase: "checking",
      status: translate("desktop.updateChecking"),
      percent: 0,
      error: null
    });
  });

  autoUpdater.on("update-available", (info) => {
    const version = safeUpdateVersion(info?.version);
    if (!version) {
      logUpdater("update_available_metadata_rejected");
      sendUpdateState(updaterFailureStateForCurrentVersion());
      return;
    }
    logUpdater("update-available", `version=${version}`);
    sendUpdateState({
      phase: "downloading",
      version,
      status: translate("desktop.updateFound", { version }),
      percent: 0,
      error: null
    });

    showUpdateNotification(
      translate("desktop.updateFoundNotification"),
      translate("desktop.updateFoundNotificationBody", { version })
    );
  });

  autoUpdater.on("update-not-available", (info) => {
    const version = info?.version
      ? safeUpdateVersion(info.version)
      : safeUpdateVersion(app.getVersion());
    if (!version) {
      logUpdater("update_not_available_metadata_rejected");
      sendUpdateState(updaterFailureStateForCurrentVersion());
      return;
    }
    logUpdater("update-not-available", `latest=${version}`);
    sendUpdateState({
      phase: "current",
      version,
      status: translate("desktop.updateNotAvailable"),
      percent: 100,
      error: null
    });

    // Do not leave the harmless "up to date" banner on screen forever.
    setTimeout(() => {
      if (updaterState.phase === "current") {
        sendUpdateState({ phase: "idle", status: "", percent: 0 });
      }
    }, 3500);
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = safeUpdatePercent(progress?.percent);
    if (percent === null) {
      logUpdater("download_progress_rejected");
      return;
    }
    sendUpdateState({
      phase: "downloading",
      status: translate("desktop.updateDownloading", { percent }),
      percent,
      error: null
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    const version = safeUpdateVersion(info?.version);
    if (!version) {
      logUpdater("update_downloaded_metadata_rejected");
      sendUpdateState(updaterFailureStateForCurrentVersion());
      return;
    }
    logUpdater("update-downloaded", `version=${version}`);

    sendUpdateState({
      phase: "ready",
      version,
      status: translate("desktop.updateReady", { version }),
      percent: 100,
      error: null
    });

    void installUpdateSilently("downloaded");
  });

  autoUpdater.on("error", () => {
    logUpdater("auto_updater_error");

    // IMPORTANT: never hide updater errors. This is how Defender/download
    // failures become visible to the user instead of silently disappearing.
    sendUpdateState(updaterFailureStateForCurrentVersion());

    showUpdateNotification(translate("desktop.updateErrorNotification"), safeUpdaterFailure());
  });
}

async function setupScreenCapture() {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false
      });

      let source = null;

      if (selectedDisplaySourceId) {
        source = sources.find((s) => s.id === selectedDisplaySourceId) || null;
      }

      source = source || sources.find((s) => s.id.startsWith("screen:")) || sources[0] || null;

      selectedDisplaySourceId = null;

      if (!source) {
        callback({});
        return;
      }

      callback({
        video: source
      });
    } catch {
      console.error("[echoverse.display_capture_failed]");
      selectedDisplaySourceId = null;
      callback({});
    }
  });
}

function createTray() {
  if (tray) return;

  try {
    let icon;

    if (process.platform === "win32") {
      icon = nativeImage.createFromPath(brandingIco).resize({ width: 16, height: 16 });
    } else {
      icon = nativeImage.createFromPath(brandingIcon).resize({ width: 18, height: 18 });
      if (process.platform === "darwin") icon.setTemplateImage(false);
    }

    if (!icon || icon.isEmpty()) {
      icon = nativeImage.createFromPath(brandingIcon).resize({ width: 18, height: 18 });
    }

    tray = new Tray(icon);
    tray.setToolTip(translate("app.name"));

    const menu = Menu.buildFromTemplate([
      {
        label: translate("desktop.trayOpen"),
        click: () => {
          if (!mainWindow) createWindow();
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
      { type: "separator" },
      {
        label: translate("desktop.trayCheckUpdates"),
        click: () => {
          if (!mainWindow) createWindow();
          mainWindow?.webContents.send("tray:check-updates");
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
      { type: "separator" },
      {
        label: translate("desktop.trayQuit"),
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(menu);

    tray.on("click", () => {
      if (!mainWindow) createWindow();

      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
        mainWindow?.focus();
      }
    });

    tray.on("double-click", () => {
      if (!mainWindow) createWindow();
      mainWindow?.show();
      mainWindow?.focus();
    });
  } catch {
    console.error("[echoverse.tray_setup_failed]");
  }
}

function createWindow() {
  const preloadPath = app.isPackaged
    ? path.join(process.resourcesPath, "preload.bundle.cjs")
    : path.join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "tmp",
        "generated",
        "desktop-electron",
        "preload.bundle.cjs"
      );

  mainWindow = new BrowserWindow({
    show: false,
    icon: process.platform === "win32" ? brandingIco : brandingIcon,
    width: 1450,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#101218",
    title: translate("app.name"),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["media", "display-capture"].includes(permission));
  });

  setupScreenCapture();

  let rendererFallbackAttempted = false;

  if (process.argv.includes("--dev")) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    const rendererEntrypoint =
      activeUi.entrypoint ||
      path.join(activeUi.directory || path.join(__dirname, "..", "dist"), "index.html");
    mainWindow.loadFile(rendererEntrypoint);
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.once("did-fail-load", (_event, errorCode, errorDescription) => {
    if (errorCode === -3) return;
    logUpdater("renderer_load_failed", `code=${errorCode} description=${errorDescription}`);
    if (rendererFallbackAttempted || process.argv.includes("--dev")) {
      mainWindow?.show();
      return;
    }
    rendererFallbackAttempted = true;
    const bundledDirectory = path.join(__dirname, "..", "dist");
    activeUi = {
      directory: bundledDirectory,
      entrypoint: path.join(bundledDirectory, "index.html"),
      version: null,
      webRevision: null,
      source: "bundled"
    };
    logUpdater("renderer_fallback_bundled");
    void mainWindow?.loadFile(activeUi.entrypoint);
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (process.argv.includes("--dev") && url.startsWith("http://localhost:5173")) return;
    if (!process.argv.includes("--dev") && url.startsWith("file://")) {
      try {
        const fileUrl = new URL(url);
        const decodedPath = decodeURIComponent(fileUrl.pathname);
        const filePath =
          process.platform === "win32" ? decodedPath.replace(/^\//u, "") : decodedPath;
        const allowedRoot = path.resolve(activeUi.directory || path.join(__dirname, "..", "dist"));
        if (path.resolve(filePath).startsWith(`${allowedRoot}${path.sep}`)) return;
      } catch {}
    }
    event.preventDefault();
  });

  mainWindow.webContents.once("did-finish-load", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) return;

    event.preventDefault();
    mainWindow.hide();

    if (process.platform === "darwin") {
      app.dock?.hide();
    }
  });

  mainWindow.on("show", () => {
    if (process.platform === "darwin") {
      app.dock?.show();
    }
  });
}

function createSplash() {
  try {
    splashWindow = new BrowserWindow({
      width: 520,
      height: 760,
      frame: false,
      transparent: false,
      resizable: false,
      show: false,
      alwaysOnTop: true,
      backgroundColor: "#050510",
      icon: process.platform === "win32" ? brandingIco : brandingIcon,
      webPreferences: { contextIsolation: true, sandbox: true }
    });

    splashWindow.loadFile(splashImage);
    splashWindow.once("ready-to-show", () => splashWindow?.show());
  } catch {
    console.error("[echoverse.splash_setup_failed]");
  }
}

function runPackagedSmokeTest() {
  const requiredFiles = [
    path.join(__dirname, "..", "dist", "index.html"),
    path.join(localizationRoot(), "en.json"),
    path.join(localizationRoot(), "tr.json"),
    path.join(brandingRoot, "echoverse-icon.png")
  ];
  const missing = requiredFiles.filter((file) => !fs.existsSync(file));
  if (missing.length > 0) {
    console.error(`[echoverse.smoke_missing_assets:${missing.length}]`);
    app.exit(1);
    return;
  }
  app.exit(0);
}

async function prepareStartupUi() {
  const bundledDirectory = path.join(__dirname, "..", "dist");
  const config = readConfig();
  const uiConfig = config?.uiUpdate;
  if (!app.isPackaged || !uiConfig?.enabled || typeof uiConfig.manifestUrl !== "string") {
    activeUi = {
      directory: bundledDirectory,
      entrypoint: path.join(bundledDirectory, "index.html"),
      version: null,
      webRevision: null,
      source: "bundled"
    };
    return;
  }

  const result = await prepareUiUpdate({
    manifestUrl: uiConfig.manifestUrl,
    cacheRoot: path.join(app.getPath("userData"), "ui-cache"),
    bundledDirectory,
    shellVersion: app.getVersion(),
    publicKeyDerBase64: uiSigningPublicKey
  });
  activeUi = {
    directory: result.directory,
    entrypoint: result.entrypoint,
    version: result.version,
    webRevision: result.webRevision,
    source: result.source
  };
  logUpdater(
    "ui_ready",
    `source=${result.source}${result.version ? ` shell=${result.version}` : ""}${
      result.webRevision ? ` web=${result.webRevision}` : ""
    }`
  );
  if (result.fallback) logUpdater("ui_update_fallback", result.error || "unknown");
}

app.whenReady().then(async () => {
  app.setName("EchoVerse");
  if (process.platform === "win32") app.setAppUserModelId("com.echoverse.desktop");
  if (
    process.env.ECHO_VERSE_SMOKE_TEST === "1" ||
    process.argv.includes("--echoverse-smoke-test")
  ) {
    runPackagedSmokeTest();
    return;
  }

  // The tray keeps its own context menu; remove Electron's native File/Edit
  // application menu from the main window on every supported platform.
  Menu.setApplicationMenu(null);
  removeLegacyIntegrationData();
  setupAutoUpdater();

  // Do not create or reveal the application window until the packaged updater
  // has checked GitHub Releases and, when needed, installed the update.
  const startupUpdate = await runStartupUpdateGate();
  if (startupUpdate.installing) return;

  try {
    await prepareStartupUi();
  } catch (error) {
    // A malformed/stale cached UI must not prevent the shell from opening.
    // prepareUiUpdate already returns a bundled fallback for expected errors;
    // this guard handles unexpected filesystem/runtime failures as well.
    logUpdater("ui_prepare_failed", error instanceof Error ? error.message : "unknown");
    const bundledDirectory = path.join(__dirname, "..", "dist");
    activeUi = {
      directory: bundledDirectory,
      entrypoint: path.join(bundledDirectory, "index.html"),
      version: null,
      webRevision: null,
      source: "bundled"
    };
  }
  createSplash();
  createTray();
  createWindow();

  app.on("activate", () => {
    if (!mainWindow) createWindow();
    mainWindow?.show();
    mainWindow?.focus();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // Keep EchoVerse alive in tray/menu bar.
});
ipcMain.handle("update:check", async () => {
  const result = await runUpdateCheck("manual");
  return {
    ok: result.ok,
    error: result.error,
    version: result.version,
    available: result.available
  };
});

ipcMain.handle("update:get-state", async () => updaterState);

ipcMain.handle("update:install", async () => {
  if (!app.isPackaged) {
    return { ok: false, error: translate("desktop.updaterInstalledOnly") };
  }

  if (updaterState.phase !== "ready") {
    return { ok: false, error: translate("desktop.updateInstallReadyMissing") };
  }

  return installUpdateSilently("manual")
    ? { ok: true }
    : { ok: false, error: safeUpdaterFailure() };
});

ipcMain.handle("update:get-log-path", async () => updaterLogPath());

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
  Notification
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

let mainWindow = null;
let splashWindow = null;
let tray = null;
const brandingIcon = path.join(__dirname, "..", "assets", "echoverse-icon.png");
const brandingIco = path.join(__dirname, "..", "assets", "echoverse.ico");
const splashImage = path.join(__dirname, "..", "assets", "echoverse-splash.png");
let tray = null;
let isQuitting = false;
let spotifyTokens = null;
let spotifyLoginServer = null;
let selectedDisplaySourceId = null;
let updaterSetupDone = false;
let updateInstallTimer = null;
let updaterState = {
  phase: "idle",
  status: "",
  version: null,
  percent: 0,
  error: null
};


const SPOTIFY_CALLBACK_PORT = 43821;
const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${SPOTIFY_CALLBACK_PORT}/callback`;

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
      spotifyClientId: ""
    };
  }
}

function spotifyTokenPath() {
  return path.join(app.getPath("userData"), "spotify-token.bin");
}

function saveSpotifyTokens(tokens) {
  spotifyTokens = tokens;

  try {
    const raw = Buffer.from(JSON.stringify(tokens), "utf8");
    const out = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(raw.toString("utf8"))
      : raw;
    fs.writeFileSync(spotifyTokenPath(), out);
  } catch (err) {
    console.error("Spotify token save error", err);
  }
}

function loadSpotifyTokens() {
  try {
    if (!fs.existsSync(spotifyTokenPath())) return null;

    const raw = fs.readFileSync(spotifyTokenPath());
    const text = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString("utf8");

    spotifyTokens = JSON.parse(text);
    return spotifyTokens;
  } catch {
    return null;
  }
}

function clearSpotifyTokens() {
  spotifyTokens = null;
  try {
    fs.rmSync(spotifyTokenPath(), { force: true });
  } catch {}
}

function b64url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function refreshSpotifyToken() {
  if (!spotifyTokens?.refresh_token) throw new Error("Spotify bağlı değil.");

  const clientId = readConfig().spotifyClientId;
  if (!clientId || clientId.startsWith("SPOTIFY_CLIENT_ID")) {
    throw new Error("Spotify Client ID ayarlanmamış.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: spotifyTokens.refresh_token,
    client_id: clientId
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!res.ok) {
    clearSpotifyTokens();
    throw new Error(`Spotify token yenilenemedi (${res.status}).`);
  }

  const next = await res.json();
  saveSpotifyTokens({
    ...spotifyTokens,
    ...next,
    refresh_token: next.refresh_token || spotifyTokens.refresh_token,
    expires_at: Date.now() + (next.expires_in || 3600) * 1000
  });

  return spotifyTokens.access_token;
}

async function spotifyAccessToken() {
  if (!spotifyTokens) loadSpotifyTokens();
  if (!spotifyTokens) throw new Error("Spotify bağlı değil.");

  if (
    !spotifyTokens.expires_at ||
    Date.now() > spotifyTokens.expires_at - 60_000
  ) {
    return refreshSpotifyToken();
  }

  return spotifyTokens.access_token;
}

async function spotifyApi(endpoint, options = {}) {
  const token = await spotifyAccessToken();

  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (res.status === 204) return null;

  if (res.status === 401) {
    await refreshSpotifyToken();
    return spotifyApi(endpoint, options);
  }

  if (!res.ok) {
    let details = "";
    try {
      details = JSON.stringify(await res.json());
    } catch {}
    throw new Error(`Spotify API ${res.status}: ${details}`);
  }

  return res.json();
}

async function activeSpotifyDevice() {
  const devices = await spotifyApi("/me/player/devices");
  return (
    devices?.devices?.find(d => d.is_active) ||
    devices?.devices?.find(d => !d.is_restricted) ||
    null
  );
}

ipcMain.handle("echoverse:getConfig", () => readConfig());

ipcMain.handle("echoverse:notify", (_evt, { title, body }) => {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: String(title || "EchoVerse"),
        body: String(body || "")
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

  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail && !source.thumbnail.isEmpty()
      ? source.thumbnail.toDataURL()
      : "",
    appIcon: source.appIcon && !source.appIcon.isEmpty()
      ? source.appIcon.toDataURL()
      : ""
  }));
});

ipcMain.handle("capture:selectSource", (_evt, sourceId) => {
  selectedDisplaySourceId = String(sourceId || "");
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

ipcMain.handle("spotify:status", async () => {
  const cfg = readConfig();

  if (!cfg.spotifyClientId || cfg.spotifyClientId.startsWith("SPOTIFY_CLIENT_ID")) {
    return {
      connected: false,
      configured: false,
      error: "Spotify Client ID ayarlanmamış."
    };
  }

  if (!spotifyTokens) loadSpotifyTokens();
  if (!spotifyTokens) {
    return { connected: false, configured: true };
  }

  try {
    const me = await spotifyApi("/me");
    return {
      connected: true,
      configured: true,
      displayName: me.display_name || me.id
    };
  } catch (err) {
    return {
      connected: false,
      configured: true,
      error: String(err.message || err)
    };
  }
});

ipcMain.handle("spotify:logout", async () => {
  clearSpotifyTokens();
  return { ok: true };
});

ipcMain.handle("spotify:login", async () => {
  const clientId = readConfig().spotifyClientId;

  if (!clientId || clientId.startsWith("SPOTIFY_CLIENT_ID")) {
    throw new Error("Önce desktop/config.json içine Spotify Client ID gir.");
  }

  if (spotifyLoginServer) {
    try { spotifyLoginServer.close(); } catch {}
    spotifyLoginServer = null;
  }

  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(
    crypto.createHash("sha256").update(verifier).digest()
  );
  const state = b64url(crypto.randomBytes(16));

  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing"
  ];

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", SPOTIFY_REDIRECT_URI);
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", challenge);

  const loginResult = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try { spotifyLoginServer?.close(); } catch {}
      spotifyLoginServer = null;
      reject(new Error("Spotify giriş süresi doldu."));
    }, 180000);

    spotifyLoginServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, SPOTIFY_REDIRECT_URI);

        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end();
          return;
        }

        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) throw new Error(`Spotify: ${error}`);
        if (!code || returnedState !== state) throw new Error("Spotify callback geçersiz.");

        const body = new URLSearchParams({
          client_id: clientId,
          grant_type: "authorization_code",
          code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          code_verifier: verifier
        });

        const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body
        });

        if (!tokenRes.ok) {
          throw new Error(`Spotify token alınamadı (${tokenRes.status}).`);
        }

        const tokens = await tokenRes.json();

        saveSpotifyTokens({
          ...tokens,
          expires_at: Date.now() + (tokens.expires_in || 3600) * 1000
        });

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
            <body style="font-family:system-ui;background:#101218;color:white;padding:40px">
              <h2>EchoVerse Spotify bağlantısı tamamlandı ✅</h2>
              <p>Bu pencereyi kapatıp EchoVerse'e dönebilirsin.</p>
            </body>
          </html>
        `);

        clearTimeout(timeout);
        setTimeout(() => {
          try { spotifyLoginServer?.close(); } catch {}
          spotifyLoginServer = null;
        }, 500);

        resolve({ ok: true });
      } catch (err) {
        clearTimeout(timeout);
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(String(err.message || err));
        try { spotifyLoginServer?.close(); } catch {}
        spotifyLoginServer = null;
        reject(err);
      }
    });

    spotifyLoginServer.listen(SPOTIFY_CALLBACK_PORT, "127.0.0.1", () => {
      shell.openExternal(authUrl.toString());
    });
  });

  return loginResult;
});

ipcMain.handle("spotify:playback", async () => {
  const state = await spotifyApi("/me/player");
  if (!state || !state.item) return null;

  return {
    trackUri: state.item.uri,
    trackName: state.item.name,
    artistName: (state.item.artists || []).map(a => a.name).join(", "),
    albumImage: state.item.album?.images?.[0]?.url || "",
    positionMs: state.progress_ms || 0,
    isPlaying: !!state.is_playing,
    timestamp: Date.now()
  };
});

ipcMain.handle("spotify:applySync", async (_evt, sync) => {
  const device = await activeSpotifyDevice();

  if (!device) {
    throw new Error("Aktif Spotify cihazı yok. Spotify uygulamasında bir şarkı aç.");
  }

  const deviceQuery = `?device_id=${encodeURIComponent(device.id)}`;
  const desiredPos = Math.max(
    0,
    Number(sync.positionMs || 0) +
      (sync.isPlaying ? Math.max(0, Date.now() - Number(sync.updatedAt || Date.now())) : 0)
  );

  const current = await spotifyApi("/me/player");
  const currentUri = current?.item?.uri;

  if (sync.trackUri && currentUri !== sync.trackUri) {
    await spotifyApi(`/me/player/play${deviceQuery}`, {
      method: "PUT",
      body: JSON.stringify({
        uris: [sync.trackUri],
        position_ms: desiredPos
      })
    });
  } else if (sync.trackUri) {
    if (Math.abs((current?.progress_ms || 0) - desiredPos) > 1800) {
      await spotifyApi(
        `/me/player/seek?position_ms=${Math.round(desiredPos)}&device_id=${encodeURIComponent(device.id)}`,
        { method: "PUT" }
      );
    }

    if (sync.isPlaying && !current?.is_playing) {
      await spotifyApi(`/me/player/play${deviceQuery}`, { method: "PUT" });
    }

    if (!sync.isPlaying && current?.is_playing) {
      await spotifyApi(`/me/player/pause${deviceQuery}`, { method: "PUT" });
    }
  }

  return { ok: true };
});

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
    return { ok: false, error: "Updater sadece kurulu uygulamada çalışır." };
  }

  try {
    logUpdater(`Checking for updates (${source})`, `current=${app.getVersion()}`);
    const result = await autoUpdater.checkForUpdates();

    return {
      ok: true,
      version: result?.updateInfo?.version || null
    };
  } catch (error) {
    const message = error?.message || String(error);
    logUpdater("Update check failed", message);
    sendUpdateState({
      phase: "error",
      status: `Güncelleme hatası: ${message}`,
      error: message
    });

    return { ok: false, error: message };
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged || updaterSetupDone) return;
  updaterSetupDone = true;

  // GitHub Releases is configured by build.publish in package.json.
  // Download automatically, but only install after the package is fully downloaded.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    logUpdater("checking-for-update");
    sendUpdateState({
      phase: "checking",
      status: "Güncelleme kontrol ediliyor…",
      percent: 0,
      error: null
    });
  });

  autoUpdater.on("update-available", info => {
    logUpdater("update-available", `version=${info.version}`);
    sendUpdateState({
      phase: "downloading",
      version: info.version,
      status: `Yeni EchoVerse ${info.version} sürümü bulundu. İndiriliyor…`,
      percent: 0,
      error: null
    });

    showUpdateNotification(
      "EchoVerse güncellemesi bulundu",
      `v${info.version} otomatik indiriliyor.`
    );
  });

  autoUpdater.on("update-not-available", info => {
    logUpdater("update-not-available", `latest=${info?.version || "unknown"}`);
    sendUpdateState({
      phase: "current",
      version: info?.version || app.getVersion(),
      status: "EchoVerse güncel.",
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

  autoUpdater.on("download-progress", progress => {
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
    sendUpdateState({
      phase: "downloading",
      status: `Güncelleme indiriliyor… %${percent}`,
      percent,
      error: null
    });
  });

  autoUpdater.on("update-downloaded", info => {
    logUpdater("update-downloaded", `version=${info.version}`);

    sendUpdateState({
      phase: "ready",
      version: info.version,
      status: `EchoVerse ${info.version} hazır. Uygun olduğunda yeniden başlatıp kurabilirsin.`,
      percent: 100,
      error: null
    });

    showUpdateNotification(
      "EchoVerse güncellemesi hazır",
      `v${info.version} kurulum için uygulamayı yeniden başlatacak.`
    );
});

  autoUpdater.on("error", err => {
    const message = err?.message || String(err);
    logUpdater("autoUpdater error", message);

    // IMPORTANT: never hide updater errors. This is how Defender/download
    // failures become visible to the user instead of silently disappearing.
    sendUpdateState({
      phase: "error",
      status: `Güncelleme hatası: ${message}`,
      error: message
    });

    showUpdateNotification(
      "EchoVerse güncelleme hatası",
      message
    );
  });

  // Give renderer time to attach its listeners, then check automatically.
  setTimeout(() => {
    runUpdateCheck("startup");
  }, 4500);
}


async function setupScreenCapture() {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 0, height: 0 },
          fetchWindowIcons: false
        });

        let source = null;

        if (selectedDisplaySourceId) {
          source = sources.find(s => s.id === selectedDisplaySourceId) || null;
        }

        source =
          source ||
          sources.find(s => s.id.startsWith("screen:")) ||
          sources[0] ||
          null;

        selectedDisplaySourceId = null;

        if (!source) {
          callback({});
          return;
        }

        callback({
          video: source
        });
      } catch (err) {
        console.error("Display capture failed:", err);
        selectedDisplaySourceId = null;
        callback({});
      }
    }
  );
}


function createTray() {
  if (tray) return;

  let icon = nativeImage.createEmpty();

  if (process.platform === "darwin") {
    icon = nativeImage.createFromBuffer(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAIklEQVR42mNgGAWjYBSMglEwCkbB////P4bRMApGwSgYBaNgFAwAAGm6Axf2zQwkAAAAAElFTkSuQmCC",
        "base64"
      )
    );
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip("EchoVerse");

  const menu = Menu.buildFromTemplate([
    {
      label: "EchoVerse'ü Aç",
      click: () => {
        if (!mainWindow) createWindow();
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    { type: "separator" },
    {
      label: "Tamamen Kapat",
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
}

function createWindow() {
  mainWindow = new BrowserWindow({
    icon: process.platform === "win32" ? brandingIco : brandingIcon,
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

  setupScreenCapture();

  if (process.argv.includes("--dev")) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.once("did-finish-load", setupAutoUpdater);

  mainWindow.on("close", event => {
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
      width: 520, height: 760, frame: false, transparent: false,
      resizable: false, show: false, alwaysOnTop: true,
      backgroundColor: "#050510",
      icon: process.platform === "win32" ? brandingIco : brandingIcon,
      webPreferences: { contextIsolation: true, sandbox: true }
    });
    const splashHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050510}
      body{display:grid;place-items:center;font-family:Inter,Segoe UI,sans-serif}
      .wrap{width:100%;height:100%;position:relative;background:#050510}
      img{width:100%;height:100%;object-fit:cover}
      .status{position:absolute;left:0;right:0;bottom:28px;text-align:center;color:#8d8aa8;font-size:12px;letter-spacing:.08em}
    </style></head><body><div class="wrap"><img src="file://${splashImage.replace(/\\/g,"/")}"><div class="status">EchoVerse hazırlanıyor…</div></div></body></html>`;
    splashWindow.loadURL("data:text/html;charset=UTF-8," + encodeURIComponent(splashHtml));
    splashWindow.once("ready-to-show", () => splashWindow?.show());
  } catch {}
}

function createTray() {
  if (tray || process.platform !== "win32") return;
  try {
    const trayImage = nativeImage.createFromPath(brandingIco).resize({width:16,height:16});
    tray = new Tray(trayImage);
    tray.setToolTip("EchoVerse");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "EchoVerse'ü Aç", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: "separator" },
      { label: "Güncellemeleri Kontrol Et", click: () => mainWindow?.webContents.send("tray:check-updates") },
      { type: "separator" },
      { label: "Çıkış", click: () => { app.isQuitting = true; app.quit(); } }
    ]));
    tray.on("double-click", () => { mainWindow?.show(); mainWindow?.focus(); });
  } catch {}
}

app.whenReady().then(() => {
  loadSpotifyTokens();
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
  return runUpdateCheck("manual");
});

ipcMain.handle("update:get-state", async () => updaterState);

ipcMain.handle("update:install", async () => {
  if (!app.isPackaged) {
    return { ok: false, error: "Updater sadece kurulu uygulamada çalışır." };
  }

  if (updaterState.phase !== "ready") {
    return { ok: false, error: "Kurulmaya hazır bir güncelleme yok." };
  }

  try {
    if (updateInstallTimer) {
      clearTimeout(updateInstallTimer);
      updateInstallTimer = null;
    }

    isQuitting = true;
    logUpdater("Manual quitAndInstall");
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  } catch (error) {
    const message = error?.message || String(error);
    return { ok: false, error: message };
  }
});

ipcMain.handle("update:get-log-path", async () => updaterLogPath());


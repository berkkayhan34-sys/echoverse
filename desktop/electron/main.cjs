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
let tray = null;
let isQuitting = false;
let spotifyTokens = null;
let spotifyLoginServer = null;
let selectedDisplaySourceId = null;

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
  if (!app.isPackaged) return { ok: false, error: "Updater sadece kurulu uygulamada çalışır." };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, version: result?.updateInfo?.version || null };
  } catch (error) {
    sendUpdateStatus(`Güncelleme hatası: ${error?.message || error}`);
    return { ok: false, error: error?.message || String(error) };
  }
});


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
const {
  safeUpdatePercent,
  safeUpdateVersion,
  safeUpdaterFailure
} = require("./updater-validation.cjs");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

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
  } catch {
    console.error("Spotify token save error");
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
    throw new Error("OS secure storage is unavailable");
  }
  if (!validAuthSession(value)) throw new Error("Invalid auth session");
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

function b64url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function validatedSpotifyTokenResponse(value) {
  if (!value || typeof value !== "object") return null;
  if (
    typeof value.access_token !== "string" ||
    value.access_token.length < 1 ||
    value.access_token.length > 4096
  ) {
    return null;
  }
  if (value.token_type !== "Bearer") return null;
  if (!Number.isInteger(value.expires_in) || value.expires_in < 1 || value.expires_in > 86_400) {
    return null;
  }
  if (
    value.refresh_token !== undefined &&
    (typeof value.refresh_token !== "string" ||
      value.refresh_token.length < 1 ||
      value.refresh_token.length > 4096)
  ) {
    return null;
  }
  return {
    access_token: value.access_token,
    token_type: value.token_type,
    expires_in: value.expires_in,
    ...(value.refresh_token ? { refresh_token: value.refresh_token } : {})
  };
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

  const next = validatedSpotifyTokenResponse(await res.json());
  if (!next) {
    clearSpotifyTokens();
    throw new Error("Spotify token yanıtı geçersiz.");
  }
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

  if (!spotifyTokens.expires_at || Date.now() > spotifyTokens.expires_at - 60_000) {
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
    throw new Error("Spotify API isteği başarısız oldu.");
  }

  return res.json();
}

async function activeSpotifyDevice() {
  const devices = await spotifyApi("/me/player/devices");
  return (
    devices?.devices?.find((d) => d.is_active) ||
    devices?.devices?.find((d) => !d.is_restricted) ||
    null
  );
}

ipcMain.handle("echoverse:getConfig", () => readConfig());

ipcMain.handle("auth:get-session", () => loadAuthSession());
ipcMain.handle("auth:set-session", (_evt, value) => saveAuthSession(value));
ipcMain.handle("auth:clear-session", () => clearAuthSession());

ipcMain.handle("echoverse:notify", (_evt, payload) => {
  try {
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.title !== "string" ||
      typeof payload.body !== "string" ||
      payload.title.length > 200 ||
      payload.body.length > 1000
    ) {
      return { ok: false, error: "Bildirim verisi geçersiz." };
    }
    const { title, body } = payload;
    if (Notification.isSupported()) {
      new Notification({
        title: title.trim() || "EchoVerse",
        body: body.trim()
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
    return { ok: false, error: "Ekran kaynağı geçersiz." };
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
  } catch {
    return {
      connected: false,
      configured: true,
      error: "Spotify bağlantısı doğrulanamadı."
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
    try {
      spotifyLoginServer.close();
    } catch {}
    spotifyLoginServer = null;
  }

  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
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
      try {
        spotifyLoginServer?.close();
      } catch {}
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

        const tokens = validatedSpotifyTokenResponse(await tokenRes.json());
        if (!tokens) throw new Error("Spotify token yanıtı geçersiz.");

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
          try {
            spotifyLoginServer?.close();
          } catch {}
          spotifyLoginServer = null;
        }, 500);

        resolve({ ok: true });
      } catch (err) {
        clearTimeout(timeout);
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Spotify bağlantısı kurulamadı.");
        try {
          spotifyLoginServer?.close();
        } catch {}
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

  const trackUri = state.item.uri;
  const trackName = state.item.name;
  const artistName = (state.item.artists || []).map((a) => a.name).join(", ");
  const albumImage = state.item.album?.images?.[0]?.url || "";
  if (
    typeof trackUri !== "string" ||
    trackUri.length > 512 ||
    typeof trackName !== "string" ||
    trackName.length > 512 ||
    typeof artistName !== "string" ||
    artistName.length > 512 ||
    typeof albumImage !== "string" ||
    albumImage.length > 2048 ||
    (albumImage && !/^https:\/\//i.test(albumImage))
  ) {
    return null;
  }

  return {
    trackUri,
    trackName,
    artistName,
    albumImage,
    positionMs: Number.isFinite(state.progress_ms) ? Math.max(0, state.progress_ms) : 0,
    isPlaying: !!state.is_playing,
    timestamp: Date.now()
  };
});

ipcMain.handle("spotify:applySync", async (_evt, sync) => {
  if (
    !sync ||
    typeof sync !== "object" ||
    (sync.trackUri !== undefined &&
      (typeof sync.trackUri !== "string" || sync.trackUri.length > 512)) ||
    (sync.positionMs !== undefined &&
      (typeof sync.positionMs !== "number" ||
        !Number.isFinite(sync.positionMs) ||
        sync.positionMs < 0 ||
        sync.positionMs > 86_400_000)) ||
    (sync.updatedAt !== undefined &&
      (typeof sync.updatedAt !== "number" ||
        !Number.isFinite(sync.updatedAt) ||
        sync.updatedAt < 0)) ||
    (sync.isPlaying !== undefined && typeof sync.isPlaying !== "boolean")
  ) {
    return { ok: false, error: "Spotify durumu geçersiz." };
  }
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
    const currentVersion = safeUpdateVersion(app.getVersion());
    if (!currentVersion || !["automatic", "manual", "startup"].includes(source)) {
      logUpdater("Update check rejected");
      return { ok: false, error: safeUpdaterFailure() };
    }
    logUpdater(`Checking for updates (${source})`, `current=${currentVersion}`);
    const result = await autoUpdater.checkForUpdates();
    const version = result?.updateInfo?.version
      ? safeUpdateVersion(result.updateInfo.version)
      : null;
    if (result?.updateInfo?.version && !version) {
      logUpdater("Update metadata rejected");
      return { ok: false, error: safeUpdaterFailure() };
    }

    return {
      ok: true,
      version
    };
  } catch {
    logUpdater("Update check failed");
    sendUpdateState({
      phase: "error",
      status: safeUpdaterFailure(),
      error: safeUpdaterFailure()
    });

    return { ok: false, error: safeUpdaterFailure() };
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

  autoUpdater.on("update-available", (info) => {
    const version = safeUpdateVersion(info?.version);
    if (!version) {
      logUpdater("update-available metadata rejected");
      sendUpdateState({
        phase: "error",
        status: safeUpdaterFailure(),
        error: safeUpdaterFailure()
      });
      return;
    }
    logUpdater("update-available", `version=${version}`);
    sendUpdateState({
      phase: "downloading",
      version,
      status: `Yeni EchoVerse ${version} sürümü bulundu. İndiriliyor…`,
      percent: 0,
      error: null
    });

    showUpdateNotification("EchoVerse güncellemesi bulundu", `v${version} otomatik indiriliyor.`);
  });

  autoUpdater.on("update-not-available", (info) => {
    const version = info?.version
      ? safeUpdateVersion(info.version)
      : safeUpdateVersion(app.getVersion());
    if (!version) {
      logUpdater("update-not-available metadata rejected");
      sendUpdateState({
        phase: "error",
        status: safeUpdaterFailure(),
        error: safeUpdaterFailure()
      });
      return;
    }
    logUpdater("update-not-available", `latest=${version}`);
    sendUpdateState({
      phase: "current",
      version,
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

  autoUpdater.on("download-progress", (progress) => {
    const percent = safeUpdatePercent(progress?.percent);
    if (percent === null) {
      logUpdater("download-progress rejected");
      return;
    }
    sendUpdateState({
      phase: "downloading",
      status: `Güncelleme indiriliyor… %${percent}`,
      percent,
      error: null
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    const version = safeUpdateVersion(info?.version);
    if (!version) {
      logUpdater("update-downloaded metadata rejected");
      sendUpdateState({
        phase: "error",
        status: safeUpdaterFailure(),
        error: safeUpdaterFailure()
      });
      return;
    }
    logUpdater("update-downloaded", `version=${version}`);

    sendUpdateState({
      phase: "ready",
      version,
      status: `EchoVerse ${version} hazır. Uygun olduğunda yeniden başlatıp kurabilirsin.`,
      percent: 100,
      error: null
    });

    showUpdateNotification(
      "EchoVerse güncellemesi hazır",
      `v${version} kurulum için uygulamayı yeniden başlatacak.`
    );
  });

  autoUpdater.on("error", () => {
    logUpdater("autoUpdater error");

    // IMPORTANT: never hide updater errors. This is how Defender/download
    // failures become visible to the user instead of silently disappearing.
    sendUpdateState({
      phase: "error",
      status: safeUpdaterFailure(),
      error: safeUpdaterFailure()
    });

    showUpdateNotification("EchoVerse güncelleme hatası", safeUpdaterFailure());
  });

  // Give renderer time to attach its listeners, then check automatically.
  setTimeout(() => {
    runUpdateCheck("startup");
  }, 4500);
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
      console.error("Display capture failed");
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
        label: "Güncellemeleri Kontrol Et",
        click: () => {
          if (!mainWindow) createWindow();
          mainWindow?.webContents.send("tray:check-updates");
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

    tray.on("double-click", () => {
      if (!mainWindow) createWindow();
      mainWindow?.show();
      mainWindow?.focus();
    });
  } catch {
    console.error("Tray setup failed");
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
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

  mainWindow.webContents.once("did-finish-load", () => {
    setupAutoUpdater();

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
    console.error("Splash setup failed");
  }
}

app.whenReady().then(() => {
  // The tray keeps its own context menu; remove Electron's native File/Edit
  // application menu from the main window on every supported platform.
  Menu.setApplicationMenu(null);
  loadSpotifyTokens();
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
  } catch {
    return { ok: false, error: safeUpdaterFailure() };
  }
});

ipcMain.handle("update:get-log-path", async () => updaterLogPath());

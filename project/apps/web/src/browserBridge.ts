import { createTranslator, resolveLocale } from "@echoverse/contracts";

type UpdateCallback = (status: string) => void;

const updateCallbacks = new Set<UpdateCallback>();

function defaultServerUrl() {
  if (location.hostname === "localhost") return "http://localhost:3001";
  if (location.hostname === "127.0.0.1") return "http://127.0.0.1:3001";
  if (location.hostname === "[::1]" || location.hostname === "::1") {
    return "http://[::1]:3001";
  }
  return "https://echoverse-c3d5.onrender.com";
}

function translator() {
  return createTranslator(resolveLocale(localStorage.getItem("echoverse_locale")));
}

async function requestNotifications() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {}
  }
}

const bridge = {
  getConfig: async () => ({
    // Local web development must use the local backend described by DOCS/development.md.
    serverUrl: defaultServerUrl(),
    spotifyClientId: ""
  }),

  getVersion: async () => __ECHO_VERSE_WEB_VERSION__,
  getUiVersion: async () => __ECHO_VERSE_WEB_VERSION__,

  onUpdateStatus: (callback: UpdateCallback) => {
    updateCallbacks.add(callback);
  },

  checkForUpdates: async () => {
    const message = translator()("update.webInfo");
    for (const cb of updateCallbacks) cb(message);
    return { ok: true, version: __ECHO_VERSE_WEB_VERSION__ };
  },

  notify: async ({ title, body, icon }: { title: string; body: string; icon?: string | null }) => {
    await requestNotifications();
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title || translator()("app.name"), {
        body: body || "",
        icon: icon || "./branding/echoverse-icon.png",
        badge: "./branding/echoverse-icon.png",
        tag: "echoverse-message"
      });
    }
    return { ok: true };
  },

  // Browser screen sharing uses the browser's native picker.
  screenPermission: async () => "granted",
  listScreenSources: async () => [
    {
      id: "browser-native-picker",
      name: translator()("browser.screenSourceName"),
      thumbnail: "",
      appIcon: ""
    }
  ],
  selectScreenSource: async (_sourceId: string) => ({ ok: true }),
  openScreenSettings: async () => ({ ok: true }),

  // Spotify Together is desktop-only until browser OAuth is configured.
  spotifyStatus: async () => ({
    connected: false,
    configured: false,
    error: translator()("spotify.desktopOnly")
  }),
  spotifyLogin: async () => {
    throw new Error(translator()("spotify.desktopOnly"));
  },
  spotifyLogout: async () => ({ ok: true }),
  spotifyPlayback: async () => null,
  spotifyApplySync: async (_state: any) => ({ ok: false })
};

// Electron provides the native bridge before the renderer loads. Keep it
// intact so cached web UI builds retain notifications, auth storage, capture,
// and other platform capabilities; browsers receive the fallback bridge.
if (!(window as any).echoverse) {
  (window as any).echoverse = bridge;
}

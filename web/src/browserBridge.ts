type UpdateCallback = (status: string) => void;

const updateCallbacks = new Set<UpdateCallback>();

async function requestNotifications() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch {}
  }
}

const bridge = {
  getConfig: async () => ({
    serverUrl: "https://echoverse-c3d5.onrender.com",
    spotifyClientId: ""
  }),

  getVersion: async () => "1.6.6-web",

  onUpdateStatus: (callback: UpdateCallback) => {
    updateCallbacks.add(callback);
  },

  checkForUpdates: async () => {
    const message = "Web sürümü sayfa yenilendiğinde otomatik olarak en güncel sürümü açar.";
    for (const cb of updateCallbacks) cb(message);
    return { ok: true, version: "web-latest" };
  },

  notify: async ({ title, body }: { title: string; body: string }) => {
    await requestNotifications();
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title || "EchoVerse", { body: body || "" });
    }
    return { ok: true };
  },

  // Browser screen sharing uses the browser's native picker.
  screenPermission: async () => "granted",
  listScreenSources: async () => [
    {
      id: "browser-native-picker",
      name: "Ekran / Pencere / Sekme seç",
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
    error: "Spotify Together şu an masaüstü sürümünde kullanılabilir."
  }),
  spotifyLogin: async () => {
    throw new Error("Spotify Together şu an masaüstü sürümünde kullanılabilir.");
  },
  spotifyLogout: async () => ({ ok: true }),
  spotifyPlayback: async () => null,
  spotifyApplySync: async (_state: any) => ({ ok: false })
};

(window as any).echoverse = bridge;

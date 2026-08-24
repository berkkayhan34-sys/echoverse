export {};

declare global {
  interface Window {
    echoverse?: {
      getConfig: () => Promise<{
        serverUrl: string;
        spotifyClientId?: string;
      }>;
      onUpdateStatus?: (callback: (status: string) => void) => void;

      spotifyStatus?: () => Promise<{
        connected: boolean;
        configured: boolean;
        displayName?: string;
        error?: string;
      }>;
      spotifyLogin?: () => Promise<{ ok: boolean }>;
      spotifyLogout?: () => Promise<{ ok: boolean }>;
      spotifyPlayback?: () => Promise<any>;
      spotifyApplySync?: (state: any) => Promise<{ ok: boolean }>;

      screenPermission?: () => Promise<string>;
      listScreenSources?: () => Promise<Array<{
        id: string;
        name: string;
        thumbnail?: string;
        appIcon?: string;
      }>>;
      selectScreenSource?: (sourceId: string) => Promise<{ ok: boolean }>;
      openScreenSettings?: () => Promise<{ ok: boolean }>;
      getVersion?: () => Promise<string>;
    };
  }
}

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
    };
  }
}

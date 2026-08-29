export {};

declare global {
  interface Window {
    echoverse?: {
      setLocale?: (locale: string) => Promise<{ ok: boolean }>;
      getConfig: () => Promise<{
        serverUrl: string;
        uiUpdate?: { enabled?: boolean; manifestUrl?: string };
      }>;
      authSession?: {
        get: () => Promise<{
          accessToken: string;
          refreshToken: string;
          account: { id: string; email: string; username: string; avatarData?: string | null };
        } | null>;
        set: (value: {
          accessToken: string;
          refreshToken: string;
          account: { id: string; email: string; username: string; avatarData?: string | null };
        }) => Promise<{ ok: boolean }>;
        clear: () => Promise<{ ok: boolean }>;
      };
      onUpdateStatus?: (callback: (status: string) => void) => (() => void) | void;
      onUpdateState?: (
        callback: (state: {
          phase: string;
          status: string;
          version?: string | null;
          percent?: number;
          error?: string | null;
        }) => void
      ) => (() => void) | void;
      getUpdateState?: () => Promise<{
        phase: string;
        status: string;
        version?: string | null;
        percent?: number;
        error?: string | null;
      }>;
      installUpdate?: () => Promise<{ ok: boolean; error?: string }>;
      getUpdaterLogPath?: () => Promise<string | null>;

      screenPermission?: () => Promise<string>;
      listScreenSources?: () => Promise<
        Array<{
          id: string;
          name: string;
          thumbnail?: string;
          appIcon?: string;
        }>
      >;
      selectScreenSource?: (sourceId: string) => Promise<{ ok: boolean }>;
      openScreenSettings?: () => Promise<{ ok: boolean }>;
      getVersion?: () => Promise<string>;
      getUiVersion?: () => Promise<string | null>;
      notify?: (payload: {
        title: string;
        body: string;
        icon?: string | null;
      }) => Promise<{ ok: boolean }>;
    };
  }
}

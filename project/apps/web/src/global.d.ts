export {};

declare global {
  const __ECHO_VERSE_WEB_VERSION__: string;

  interface Window {
    echoverse?: {
      isDesktop?: boolean;
      getConfig: () => Promise<{
        serverUrl: string;
      }>;
      onUpdateStatus?: (callback: (status: string) => void) => void;

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
      checkForUpdates?: () => Promise<{ ok: boolean; version?: string | null; error?: string }>;
      getVersion?: () => Promise<string>;
      getUiVersion?: () => Promise<string | null>;
      notify?: (payload: {
        title: string;
        body: string;
        icon?: string | null;
      }) => Promise<{ ok: boolean }>;
      copyText?: (value: string) => Promise<{ ok: boolean }>;
    };
  }
}

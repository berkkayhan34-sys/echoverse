export {};

declare global {
  interface Window {
    echoverse?: {
      getConfig: () => Promise<{ serverUrl: string }>;
      onUpdateStatus?: (callback: (status: string) => void) => void;
    };
  }
}

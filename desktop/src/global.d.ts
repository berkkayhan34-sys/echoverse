export {};

declare global {
  interface Window {
    echoverse?: {
      getConfig: () => Promise<{ serverUrl: string }>;
    };
  }
}

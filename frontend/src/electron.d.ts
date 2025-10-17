// Type definitions for Electron API exposed via preload script

export interface ElectronAPI {
  getBackendUrl: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  getAppDataPath: () => Promise<string>;
  platform: string;
  onInitializationProgress: (callback: (data: { percent: number; message: string }) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

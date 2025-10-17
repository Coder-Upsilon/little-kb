const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
  platform: process.platform,
  onInitializationProgress: (callback) => {
    ipcRenderer.on('initialization-progress', (event, data) => callback(data));
  }
});

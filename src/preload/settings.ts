// Preload for the settings window. Runs with node access but exposes only a
// small typed API to the isolated renderer via contextBridge.
import { contextBridge, ipcRenderer } from 'electron';
import {
  SETTINGS_CHANNELS,
  type HonyoSettingsApi,
  type SettingsPatch,
  type GeneratePromptRequest,
} from '../ipc/settings.ts';

const api: HonyoSettingsApi = {
  platform: process.platform,
  load: () => ipcRenderer.invoke(SETTINGS_CHANNELS.load),
  save: (patch: SettingsPatch) => ipcRenderer.invoke(SETTINGS_CHANNELS.save, patch),
  resetPopupSize: () => ipcRenderer.invoke(SETTINGS_CHANNELS.resetPopupSize),
  generatePrompt: (request: GeneratePromptRequest) =>
    ipcRenderer.invoke(SETTINGS_CHANNELS.generatePrompt, request),
  openExternal: (url: string) => ipcRenderer.invoke(SETTINGS_CHANNELS.openExternal, url),
};

contextBridge.exposeInMainWorld('honyo', api);

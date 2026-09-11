// Preload for the settings window. Runs with node access but exposes only a
// small typed API to the isolated renderer via contextBridge.
import { contextBridge, ipcRenderer } from 'electron';
import {
  SETTINGS_CHANNELS,
  SETTINGS_EVENTS,
  type CreateProfileRequest,
  type HonyoSettingsApi,
  type SettingsPatch,
  type GeneratePromptRequest,
} from '../ipc/settings.ts';

const api: HonyoSettingsApi = {
  // Dev aid: HONYO_THEME_PLATFORM=win32|linux previews another OS's theme.
  platform: process.env.HONYO_THEME_PLATFORM ?? process.platform,
  load: () => ipcRenderer.invoke(SETTINGS_CHANNELS.load),
  save: (patch: SettingsPatch) => ipcRenderer.invoke(SETTINGS_CHANNELS.save, patch),
  resetPopupSize: () => ipcRenderer.invoke(SETTINGS_CHANNELS.resetPopupSize),
  generatePrompt: (request: GeneratePromptRequest) =>
    ipcRenderer.invoke(SETTINGS_CHANNELS.generatePrompt, request),
  openExternal: (url: string) => ipcRenderer.invoke(SETTINGS_CHANNELS.openExternal, url),
  selectProfile: (id: string) => ipcRenderer.invoke(SETTINGS_CHANNELS.profileSelect, id),
  createProfile: (request: CreateProfileRequest) =>
    ipcRenderer.invoke(SETTINGS_CHANNELS.profileCreate, request),
  renameProfile: (id: string, name: string) =>
    ipcRenderer.invoke(SETTINGS_CHANNELS.profileRename, id, name),
  deleteProfile: (id: string) => ipcRenderer.invoke(SETTINGS_CHANNELS.profileDelete, id),
  clearHistory: () => ipcRenderer.invoke(SETTINGS_CHANNELS.clearHistory),
  onProfilesChanged: (handler: () => void) => {
    ipcRenderer.on(SETTINGS_EVENTS.profilesChanged, () => handler());
  },
};

contextBridge.exposeInMainWorld('honyo', api);

// Preload for the popup window: exposes a narrow typed API to the isolated
// renderer. Event subscriptions are one-way (main -> renderer).
import { contextBridge, ipcRenderer } from 'electron';
import {
  POPUP_CHANNELS,
  type ContextMenuRequest,
  type HonyoPopupApi,
  type PopupEventName,
  type PopupEvents,
} from '../ipc/popup.ts';

const api: HonyoPopupApi = {
  on<K extends PopupEventName>(event: K, handler: (payload: PopupEvents[K]) => void): void {
    ipcRenderer.on(event, (_e, payload: PopupEvents[K]) => handler(payload));
  },
  copyTranslation: (text: string) => ipcRenderer.send(POPUP_CHANNELS.copyTranslation, text),
  closePopup: () => ipcRenderer.send(POPUP_CHANNELS.closePopup),
  backTranslate: (text: string) => ipcRenderer.send(POPUP_CHANNELS.backTranslate, text),
  showContextMenu: (request: ContextMenuRequest) =>
    ipcRenderer.send(POPUP_CHANNELS.showContextMenu, request),
};

contextBridge.exposeInMainWorld('honyoPopup', api);

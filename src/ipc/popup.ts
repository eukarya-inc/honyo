// Shared contract between the popup window renderer and the main process.
// Must stay free of electron/node imports (bundled into renderer and preload).

export interface PopupConfig {
  fontSize: number;
}

export interface TranslationLangs {
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationData {
  translation: string;
  originalText: string;
}

export interface BackTranslationResult {
  translation: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface ContextMenuRequest {
  selectedText: string;
  hasSelection: boolean;
}

/** Events pushed from the main process to the popup, with their payloads. */
export interface PopupEvents {
  'popup-config': PopupConfig;
  'translation-loading': void;
  /** Credit line shown under the result, clickable (e.g. "Built with PLaMo"). */
  'translation-credit': string;
  /** Message shown under the spinner while waiting (e.g. a model loading). */
  'translation-status': string;
  'translation-langs': TranslationLangs;
  'translation-data': TranslationData;
  'translation-chunk': string;
  'translation-complete': string;
  /** The action failed; the message is shown in place of a result. */
  'translation-error': string;
  'back-translation-result': BackTranslationResult;
  'back-translation-error': string;
  'copy-all-requested': void;
}

export type PopupEventName = keyof PopupEvents;

/** Renderer -> main channels (fire and forget). */
export const POPUP_CHANNELS = {
  copyTranslation: 'copy-translation',
  closePopup: 'close-popup',
  backTranslate: 'back-translate',
  showContextMenu: 'show-context-menu',
  openCredit: 'open-credit',
} as const;

/** API exposed to the popup renderer on `window.honyoPopup` by the preload script. */
export interface HonyoPopupApi {
  on<K extends PopupEventName>(event: K, handler: (payload: PopupEvents[K]) => void): void;
  copyTranslation(text: string): void;
  closePopup(): void;
  backTranslate(text: string): void;
  showContextMenu(request: ContextMenuRequest): void;
  /** Open the page behind the current credit line (the main process picks the URL). */
  openCredit(): void;
}

declare global {
  interface Window {
    honyoPopup: HonyoPopupApi;
  }
}

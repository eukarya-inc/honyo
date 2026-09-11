// Shared contract between the settings window renderer and the main process.
// This file must stay free of electron/node imports: it is bundled into the
// renderer and the preload script as well as used by the main process.

export type ProviderId = 'anthropic' | 'openai' | 'google';

/**
 * Flat, renderer-friendly view of everything the settings window edits. The
 * main process maps this to/from the real Config + ApiKeys shape, so the
 * renderer never needs to know how settings are stored.
 */
export interface SettingsSnapshot {
  anthropicKey: string;
  openaiKey: string;
  googleKey: string;
  customPrompt: string;
  customModelName: string;
  customModelProvider: ProviderId | '';
  /** One language per line. */
  customLanguages: string;
  autoCloseOnBlur: boolean;
  enableStreaming: boolean;
  popupFontSize: number;
  openAtLogin: boolean;
}

export type SettingsPatch = Partial<SettingsSnapshot>;

export interface GeneratePromptRequest {
  currentPrompt: string;
  instruction: string;
}

export type GeneratePromptResult =
  | { success: true; prompt: string }
  | { success: false; error: string };

export const SETTINGS_CHANNELS = {
  load: 'settings:load',
  save: 'settings:save',
  resetPopupSize: 'settings:reset-popup-size',
  generatePrompt: 'settings:generate-prompt',
  openExternal: 'settings:open-external',
} as const;

/** API exposed to the settings renderer on `window.honyo` by the preload script. */
export interface HonyoSettingsApi {
  /** `process.platform` of the host, used to pick the native-looking theme. */
  platform: string;
  load(): Promise<SettingsSnapshot>;
  save(patch: SettingsPatch): Promise<void>;
  resetPopupSize(): Promise<void>;
  generatePrompt(request: GeneratePromptRequest): Promise<GeneratePromptResult>;
  openExternal(url: string): Promise<void>;
}

declare global {
  interface Window {
    honyo: HonyoSettingsApi;
  }
}

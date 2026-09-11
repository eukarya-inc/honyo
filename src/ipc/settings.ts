// Shared contract between the settings window renderer and the main process.
// This file must stay free of electron/node imports: it is bundled into the
// renderer and the preload script as well as used by the main process.

export type ProviderId = 'anthropic' | 'openai' | 'google';

export interface ProfileSummary {
  id: string;
  name: string;
}

/**
 * Flat, renderer-friendly view of everything the settings window edits. The
 * main process maps this to/from the real Config + profile shape, so the
 * renderer never needs to know how settings are stored. Profile-scoped
 * values reflect the active profile.
 */
export interface SettingsSnapshot {
  profiles: ProfileSummary[];
  activeProfileId: string;
  anthropicKey: string;
  openaiKey: string;
  googleKey: string;
  anthropicBaseUrl: string;
  openaiBaseUrl: string;
  googleBaseUrl: string;
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

/** Keys the form edits; profile metadata is managed through the profile API. */
export type SettingsPatch = Partial<Omit<SettingsSnapshot, 'profiles' | 'activeProfileId'>>;

export interface GeneratePromptRequest {
  currentPrompt: string;
  instruction: string;
}

export type GeneratePromptResult =
  | { success: true; prompt: string }
  | { success: false; error: string };

export interface CreateProfileRequest {
  name: string;
  /** Copy settings and keys from this profile instead of starting from defaults. */
  duplicateFrom?: string;
}

export const SETTINGS_CHANNELS = {
  load: 'settings:load',
  save: 'settings:save',
  resetPopupSize: 'settings:reset-popup-size',
  generatePrompt: 'settings:generate-prompt',
  openExternal: 'settings:open-external',
  profileSelect: 'settings:profile-select',
  profileCreate: 'settings:profile-create',
  profileRename: 'settings:profile-rename',
  profileDelete: 'settings:profile-delete',
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
  selectProfile(id: string): Promise<void>;
  createProfile(request: CreateProfileRequest): Promise<ProfileSummary>;
  renameProfile(id: string, name: string): Promise<void>;
  /** Resolves false when the profile could not be deleted (e.g. it is the last one). */
  deleteProfile(id: string): Promise<boolean>;
  /** Fired when the active profile changes outside the window (tray menu). */
  onProfilesChanged(handler: () => void): void;
}

export const SETTINGS_EVENTS = {
  profilesChanged: 'settings:profiles-changed',
} as const;

declare global {
  interface Window {
    honyo: HonyoSettingsApi;
  }
}

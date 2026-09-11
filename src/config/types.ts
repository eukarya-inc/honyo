export type ProviderId = 'anthropic' | 'openai' | 'google';

export interface ApiKeys {
  anthropic: string;
  openai: string;
  google: string;
}

export type DisplayMode = 'notification' | 'popup';

export interface CustomModel {
  model: string;
  provider: ProviderId;
}

/** Per-provider connection settings. `baseUrl` targets a gateway or proxy. */
export interface ProviderSettings {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Settings that belong to a profile: everything about *what* and *how* to
 * translate. Switching profiles swaps all of these at once.
 */
export interface ProfileSettings {
  targetLanguage: string;
  secondaryLanguage: string;
  aiModel: string;
  customModel?: CustomModel;
  customPrompt: string;
  customLanguages?: string[];
  /** Global shortcut that activates this profile. */
  shortcut?: string;
  providers: Record<ProviderId, ProviderSettings>;
}

export interface Profile extends ProfileSettings {
  id: string;
  name: string;
}

export type TranslateTrigger = 'double-copy' | 'shortcut';
export type TranslateSource = 'copy-selection' | 'clipboard';

export interface ShortcutSettings {
  /** How a translation is started. */
  translateTrigger: TranslateTrigger;
  /** Electron accelerator used when translateTrigger is "shortcut". */
  translateShortcut?: string;
  /** What a custom shortcut reads: copy the selection first, or the clipboard as-is. */
  translateSource: TranslateSource;
}

/** Settings shared by all profiles: app behaviour and window state. */
export interface GlobalSettings {
  isPaused: boolean;
  shortcuts?: ShortcutSettings;
  autoCloseOnBlur?: boolean;
  enableStreaming?: boolean;
  displayMode: DisplayMode;
  openAtLogin?: boolean;
  popupFontSize?: number;
  popupSize?: { width: number; height: number };
  skippedUpdateVersion?: string;
}

/** On-disk shape of config.json (version 2). API keys are stored encrypted. */
export interface StoredConfig extends GlobalSettings {
  version: 2;
  activeProfileId: string;
  profiles: Profile[];
}

/**
 * The flat view most of the app reads: global settings merged with the active
 * profile (minus provider secrets, which are read via getApiKeys()).
 */
export interface Config extends GlobalSettings, Omit<ProfileSettings, 'providers'> {}

/** Pre-profile (version 1) config.json shape, kept for migration. */
export interface LegacyConfig extends Partial<Config> {
  fallbackLanguage?: string;
}

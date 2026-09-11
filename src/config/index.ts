import { app } from 'electron';
import { config as loadEnv } from 'dotenv';
import { DEFAULT_MODEL_KEY, CUSTOM_MODEL_ID } from '../models.ts';
import { getModelInfo } from '../models-remote.ts';
import { getLanguageFromLocale } from '../language/index.ts';
import { LANGUAGES } from '../language/constants.ts';
import { loadStoredConfig, saveStoredConfig } from './storage.ts';
import {
  buildProfile,
  duplicateProfile,
  pickProfileDefaults,
  splitUpdates,
  toFlatConfig,
  uniqueProfileName,
  PROVIDER_IDS,
} from './profiles.ts';
import type {
  ApiKeys,
  Config,
  Profile,
  ProviderId,
  ProviderSettings,
  StoredConfig,
} from './types.ts';

loadEnv();

// Global state
let store: StoredConfig;
let isPaused = false;
let profileChangedCallback: (() => void) | null = null;

// API keys from the environment act as a fallback when a profile has none.
const envApiKeys: ApiKeys = {
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  openai: process.env.OPENAI_API_KEY || '',
  google: process.env.GOOGLE_API_KEY || '',
};

function getDefaultConfig(): Config {
  const locale = app.getLocale();
  console.log('System locale:', locale);

  // Set primary language based on system language
  const primaryLang = getLanguageFromLocale(locale);

  // If primary is English, set secondary to Japanese
  const englishLang = LANGUAGES.en ?? 'English';
  const japaneseLang = LANGUAGES.ja ?? 'Japanese';
  const secondaryLang = primaryLang === englishLang ? japaneseLang : englishLang;

  return {
    targetLanguage: primaryLang,
    secondaryLanguage: secondaryLang,
    isPaused: false,
    aiModel: DEFAULT_MODEL_KEY,
    autoCloseOnBlur: true,
    enableStreaming: true,
    customPrompt: '',
    displayMode: 'notification',
    popupFontSize: 14,
  };
}

function activeProfile(): Profile {
  const found = store.profiles.find(p => p.id === store.activeProfileId);
  if (found) return found;
  // normalizeStore guarantees a profile exists; fall back defensively.
  const first = store.profiles[0];
  if (!first) throw new Error('No profiles configured');
  store.activeProfileId = first.id;
  return first;
}

export function initializeConfig(): void {
  const defaults = getDefaultConfig();
  store = loadStoredConfig(defaults);

  for (const profile of store.profiles) {
    // Check settings consistency
    if (profile.targetLanguage === profile.secondaryLanguage) {
      profile.secondaryLanguage = defaults.secondaryLanguage;
    }
    // Validate AI model exists (custom model is always allowed)
    if (profile.aiModel !== CUSTOM_MODEL_ID && !getModelInfo(profile.aiModel)) {
      console.log(`Invalid AI model in profile "${profile.name}": ${profile.aiModel}, resetting`);
      profile.aiModel = DEFAULT_MODEL_KEY;
    }
    if (profile.customPrompt === undefined) profile.customPrompt = '';
  }

  store.displayMode ??= 'notification';
  store.autoCloseOnBlur ??= true;
  store.enableStreaming ??= true;
  store.popupFontSize ??= 14;
  isPaused = store.isPaused === true;
}

/** Flat view: global settings merged with the active profile. */
export function getConfig(): Config {
  return { ...toFlatConfig(store, activeProfile()), isPaused };
}

/** Update flat settings; profile-scoped keys go to the active profile. */
export function updateConfig(updates: Partial<Config>): void {
  const { profile, global } = splitUpdates(updates);
  Object.assign(activeProfile(), profile);
  Object.assign(store, global);
  saveConfig();
}

// Clear the persisted popup size so the next popup uses the default 400x200.
export function clearPopupSize(): void {
  delete store.popupSize;
  saveConfig();
}

export function clearSkippedUpdateVersion(): void {
  if (store.skippedUpdateVersion) {
    delete store.skippedUpdateVersion;
    saveConfig();
  }
}

export function saveConfig(): void {
  store.isPaused = isPaused;
  saveStoredConfig(store);
}

// --- Providers (active profile) -------------------------------------------------

export function getApiKeys(): ApiKeys {
  const providers = activeProfile().providers;
  return {
    anthropic: providers.anthropic.apiKey || envApiKeys.anthropic,
    openai: providers.openai.apiKey || envApiKeys.openai,
    google: providers.google.apiKey || envApiKeys.google,
  };
}

export function updateApiKeys(updates: Partial<ApiKeys>): void {
  const providers = activeProfile().providers;
  for (const id of PROVIDER_IDS) {
    const value = updates[id];
    if (value !== undefined) providers[id] = { ...providers[id], apiKey: value };
  }
  saveConfig();
}

export function getProviderSettings(): Record<ProviderId, ProviderSettings> {
  return structuredClone(activeProfile().providers);
}

export function updateProviderBaseUrls(updates: Partial<Record<ProviderId, string>>): void {
  const providers = activeProfile().providers;
  for (const id of PROVIDER_IDS) {
    const value = updates[id];
    if (value === undefined) continue;
    const trimmed = value.trim();
    providers[id] = trimmed
      ? { ...providers[id], baseUrl: trimmed }
      : { apiKey: providers[id].apiKey };
  }
  saveConfig();
}

// --- Profiles ---------------------------------------------------------------------

export interface ProfileSummary {
  id: string;
  name: string;
}

export function listProfiles(): ProfileSummary[] {
  return store.profiles.map(p => ({ id: p.id, name: p.name }));
}

export function getActiveProfileId(): string {
  return activeProfile().id;
}

/**
 * Called after the active profile, the profile list, or any setting shown in
 * the tray menu changes, so the menu can be rebuilt.
 */
export function setProfileChangedCallback(callback: () => void): void {
  profileChangedCallback = callback;
}

/** Ask the tray (and an open settings window) to re-read the config. */
export function notifyConfigChanged(): void {
  profileChangedCallback?.();
}

function profilesChanged(): void {
  saveConfig();
  profileChangedCallback?.();
}

export function setActiveProfile(id: string): boolean {
  if (!store.profiles.some(p => p.id === id) || id === store.activeProfileId) return false;
  store.activeProfileId = id;
  profilesChanged();
  return true;
}

/** Create a profile with default settings (or a copy of `duplicateFrom`) and activate it. */
export function createProfile(name: string, duplicateFrom?: string): ProfileSummary {
  const finalName = uniqueProfileName(name, store.profiles);
  const source = duplicateFrom ? store.profiles.find(p => p.id === duplicateFrom) : undefined;
  const profile = source
    ? duplicateProfile(source, finalName)
    : buildProfile(finalName, pickProfileDefaults(getDefaultConfig()));
  store.profiles.push(profile);
  store.activeProfileId = profile.id;
  profilesChanged();
  return { id: profile.id, name: profile.name };
}

export function renameProfile(id: string, name: string): boolean {
  const profile = store.profiles.find(p => p.id === id);
  if (!profile) return false;
  profile.name = uniqueProfileName(name, store.profiles, id);
  profilesChanged();
  return true;
}

/** Delete a profile; the last remaining profile cannot be deleted. */
export function deleteProfile(id: string): boolean {
  if (store.profiles.length <= 1) return false;
  const index = store.profiles.findIndex(p => p.id === id);
  if (index < 0) return false;
  store.profiles.splice(index, 1);
  if (store.activeProfileId === id) {
    store.activeProfileId = store.profiles[Math.max(0, index - 1)]?.id ?? '';
  }
  profilesChanged();
  return true;
}

// --- Pause --------------------------------------------------------------------------

export function getPausedState(): boolean {
  return isPaused;
}

export function setPausedState(paused: boolean): void {
  isPaused = paused;
  saveConfig();
}

export type { ApiKeys, Config, DisplayMode, CustomModel, ProviderId } from './types.ts';

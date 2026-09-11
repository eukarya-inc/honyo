import { app } from 'electron';
import { config as loadEnv } from 'dotenv';
import { DEFAULT_MODEL_KEY, CUSTOM_MODEL_ID } from '../models.ts';
import { getModelInfo } from '../models-remote.ts';
import { getLanguageFromLocale } from '../language/index.ts';
import { LANGUAGES } from '../language/constants.ts';
import { loadStoredConfig, saveStoredConfig } from './storage.ts';
import { loadManagedConfig, EMPTY_MANAGED, type ManagedConfig } from './managed.ts';
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
let managed: ManagedConfig = EMPTY_MANAGED;
let isPaused = false;
const changeListeners: Array<() => void> = [];

// API keys from the environment act as a fallback when a profile has none.
const envApiKeys: ApiKeys = {
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  openai: process.env.OPENAI_API_KEY || '',
  google: process.env.GOOGLE_API_KEY || '',
  xai: process.env.XAI_API_KEY || '',
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
  managed = loadManagedConfig();

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
  store.historyEnabled ??= true;
  store.shortcuts ??= { translateTrigger: 'double-copy', translateSource: 'copy-selection' };
  isPaused = store.isPaused === true;
}

/** Flat view: global settings merged with the active profile (and managed overrides). */
export function getConfig(): Config {
  return { ...toFlatConfig(store, activeProfile()), isPaused };
}

// --- Managed (MDM) settings -----------------------------------------------------

export function getManagedConfig(): ManagedConfig {
  return managed;
}

/**
 * Settings-snapshot field names whose values are enforced by the
 * organisation, so the settings window can show them read-only.
 */
export function getManagedFields(): string[] {
  const fields: string[] = [];
  for (const id of PROVIDER_IDS) {
    const p = managed.providers[id];
    if (p?.apiKey) fields.push(`${id}Key`);
    if (p?.baseUrl) fields.push(`${id}BaseUrl`);
  }
  return fields;
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
  const keys: ApiKeys = {
    anthropic: providers.anthropic.apiKey || envApiKeys.anthropic,
    openai: providers.openai.apiKey || envApiKeys.openai,
    google: providers.google.apiKey || envApiKeys.google,
    xai: providers.xai.apiKey || envApiKeys.xai,
  };
  // Managed keys win over anything the user entered.
  for (const id of PROVIDER_IDS) {
    const managedKey = managed.providers[id]?.apiKey;
    if (managedKey) keys[id] = managedKey;
  }
  return keys;
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
  const providers = structuredClone(activeProfile().providers);
  for (const id of PROVIDER_IDS) {
    const m = managed.providers[id];
    if (!m) continue;
    providers[id] = {
      apiKey: m.apiKey ?? providers[id].apiKey,
      ...(m.baseUrl
        ? { baseUrl: m.baseUrl }
        : providers[id].baseUrl
          ? { baseUrl: providers[id].baseUrl }
          : {}),
    };
  }
  return providers;
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
  shortcut?: string;
}

export function listProfiles(): ProfileSummary[] {
  return store.profiles.map(p => ({
    id: p.id,
    name: p.name,
    ...(p.shortcut ? { shortcut: p.shortcut } : {}),
  }));
}

export function setProfileShortcut(id: string, shortcut: string): boolean {
  const profile = store.profiles.find(p => p.id === id);
  if (!profile) return false;
  if (shortcut.trim()) profile.shortcut = shortcut.trim();
  else delete profile.shortcut;
  profilesChanged();
  return true;
}

export function getActiveProfileId(): string {
  return activeProfile().id;
}

/**
 * Called after the active profile, the profile list, or any setting shown in
 * the tray menu changes, so the menu can be rebuilt.
 */
export function setProfileChangedCallback(callback: () => void): void {
  changeListeners.push(callback);
}

/** Ask listeners (tray, shortcuts, an open settings window) to re-read the config. */
export function notifyConfigChanged(): void {
  for (const listener of changeListeners) listener();
}

function profilesChanged(): void {
  saveConfig();
  notifyConfigChanged();
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

import { app } from 'electron';
import { config as loadEnv } from 'dotenv';
import { DEFAULT_AI_MODEL, AI_MODELS } from '../models.ts';
import { getLanguageFromLocale } from '../language/index.ts';
import { LANGUAGES } from '../language/constants.ts';
import {
  loadConfigFromFile,
  saveConfigToFile,
  loadApiKeysFromFile,
  saveApiKeysToFile,
} from './storage.ts';
import type { ApiKeys, Config } from './types.ts';

loadEnv();

// Global state
let config: Config;
let apiKeys: ApiKeys;
let isPaused = false;

// Initialize API keys from environment
const defaultApiKeys: ApiKeys = {
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
    aiModel: DEFAULT_AI_MODEL,
    autoCloseOnBlur: true,
    enableStreaming: true,
    customPrompt: '',
    displayMode: 'notification',
  };
}

export function initializeConfig(): void {
  const defaultConfig = getDefaultConfig();
  config = loadConfigFromFile(defaultConfig);

  // Check settings consistency
  if (config.targetLanguage === config.secondaryLanguage) {
    // If same language, reapply default settings
    const newDefaultConfig = getDefaultConfig();
    config.secondaryLanguage = newDefaultConfig.secondaryLanguage;
  }

  // Validate AI model exists
  if (!AI_MODELS[config.aiModel]) {
    console.log(`Invalid AI model: ${config.aiModel}, resetting to default`);
    config.aiModel = DEFAULT_AI_MODEL;
  }

  // Initialize custom prompt if not present
  if (config.customPrompt === undefined) {
    config.customPrompt = '';
  }

  // Initialize display mode if not present
  if (config.displayMode === undefined) {
    config.displayMode = 'notification';
  }

  // Initialize autoCloseOnBlur if not present
  if (config.autoCloseOnBlur === undefined) {
    config.autoCloseOnBlur = true;
  }

  // Initialize enableStreaming if not present
  if (config.enableStreaming === undefined) {
    config.enableStreaming = true;
  }

  // Restore isPaused state
  if (typeof config.isPaused === 'boolean') {
    isPaused = config.isPaused;
  }

  // Load API keys
  apiKeys = loadApiKeysFromFile(defaultApiKeys);
}

export function getConfig(): Config {
  return config;
}

export function updateConfig(updates: Partial<Config>): void {
  config = { ...config, ...updates };
  saveConfig();
}

export function clearSkippedUpdateVersion(): void {
  if (config.skippedUpdateVersion) {
    delete config.skippedUpdateVersion;
    saveConfig();
  }
}

export function saveConfig(): void {
  saveConfigToFile(config, isPaused);
}

export function getApiKeys(): ApiKeys {
  return apiKeys;
}

export function updateApiKeys(updates: Partial<ApiKeys>): void {
  apiKeys = { ...apiKeys, ...updates };
  saveApiKeysToFile(apiKeys);
}

export function getPausedState(): boolean {
  return isPaused;
}

export function setPausedState(paused: boolean): void {
  isPaused = paused;
  saveConfig();
}

export type { ApiKeys, Config, DisplayMode, CustomModel, ShortcutConfig } from './types';

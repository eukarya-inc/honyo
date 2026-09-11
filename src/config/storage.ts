import { app, safeStorage } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from 'fs';
import type { ApiKeys, Config, LegacyConfig, StoredConfig } from './types.ts';
import { migrateLegacyConfig, normalizeStore, PROVIDER_IDS } from './profiles.ts';

export const configPath = join(app.getPath('userData'), 'config.json');
/** Pre-profile plaintext key file; migrated into config.json and removed. */
export const legacyApiKeysPath = join(app.getPath('userData'), 'apikeys.json');

// --- API key encryption --------------------------------------------------------
//
// Keys are encrypted with Electron's safeStorage (Keychain on macOS, DPAPI on
// Windows, libsecret/kwallet on Linux) and stored as "enc:<base64>". Where no
// OS backend is available the key is stored as-is, so the file never becomes
// unreadable on that machine.

const ENC_PREFIX = 'enc:';

function encryptSecret(value: string): string {
  if (!value) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return ENC_PREFIX + safeStorage.encryptString(value).toString('base64');
    }
  } catch (error) {
    console.error('Failed to encrypt API key, storing unencrypted:', error);
  }
  return value;
}

function decryptSecret(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value;
  try {
    return safeStorage.decryptString(Buffer.from(value.slice(ENC_PREFIX.length), 'base64'));
  } catch (error) {
    console.error('Failed to decrypt API key (was it stored on another machine?):', error);
    return '';
  }
}

function mapSecrets(store: StoredConfig, fn: (v: string) => string): StoredConfig {
  return {
    ...store,
    profiles: store.profiles.map(p => {
      const providers = { ...p.providers };
      for (const id of PROVIDER_IDS) {
        const entry = providers[id];
        providers[id] = { ...entry, apiKey: fn(entry.apiKey ?? '') };
      }
      return { ...p, providers };
    }),
  };
}

// --- Load / save ---------------------------------------------------------------

function readLegacyApiKeys(): Partial<ApiKeys> {
  try {
    if (existsSync(legacyApiKeysPath)) {
      return JSON.parse(readFileSync(legacyApiKeysPath, 'utf8')) as Partial<ApiKeys>;
    }
  } catch (error) {
    console.error('Failed to load legacy API keys:', error);
  }
  return {};
}

/**
 * Load config.json, migrating a version-1 flat file (plus apikeys.json) into
 * the profile-based version-2 layout on first run. Returns decrypted data.
 */
export function loadStoredConfig(defaults: Config): StoredConfig {
  let raw: Record<string, unknown> | null = null;
  try {
    if (existsSync(configPath)) {
      raw = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }

  if (raw && raw.version === 2) {
    return normalizeStore(mapSecrets(raw as unknown as StoredConfig, decryptSecret), defaults);
  }

  // Version 1 (or no file): fold the flat config and the plaintext key file
  // into a single profile, persist as v2, and drop the plaintext key file.
  // Keys supplied via environment variables are NOT written to disk: they
  // keep working as a runtime fallback (see getApiKeys in index.ts).
  const legacyKeys = readLegacyApiKeys();
  const store = migrateLegacyConfig((raw ?? {}) as LegacyConfig, defaults, legacyKeys);
  if (raw || existsSync(legacyApiKeysPath)) {
    console.log('Migrating config to profile layout (v2)');
    saveStoredConfig(store);
    try {
      if (existsSync(legacyApiKeysPath)) unlinkSync(legacyApiKeysPath);
    } catch (error) {
      console.error('Failed to remove legacy apikeys.json:', error);
    }
  }
  return store;
}

export function saveStoredConfig(store: StoredConfig): void {
  try {
    writeFileSync(configPath, JSON.stringify(mapSecrets(store, encryptSecret), null, 2));
    chmodSync(configPath, 0o600);
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

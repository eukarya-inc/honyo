import { app, safeStorage } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from 'fs';
import type { ApiKeys, Config, StoredConfig } from './types.ts';
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

// safeStorage's async API (the sync one is deprecated in Electron 45 and gone
// in 46) makes encryption asynchronous, but saveConfig() is called
// synchronously all over the app. So every key's sealed form is remembered,
// as read from disk or once encrypted, and only a key that changed has to be
// encrypted before the file is written.
const sealed = new Map<string, string>();

let available: Promise<boolean> | undefined;
function encryptionAvailable(): Promise<boolean> {
  available ??= safeStorage.isAsyncEncryptionAvailable().catch(() => false);
  return available;
}

async function decryptSecret(value: string): Promise<string> {
  // Stored as-is (no OS backend when it was saved): encrypted on next save.
  if (!value.startsWith(ENC_PREFIX)) return value;
  try {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(
      Buffer.from(value.slice(ENC_PREFIX.length), 'base64'),
    );
    // Remember the stored form unless the OS asks for a fresh encryption.
    if (!shouldReEncrypt) sealed.set(result, value);
    return result;
  } catch (error) {
    console.error('Failed to decrypt API key (was it stored on another machine?):', error);
    return '';
  }
}

async function seal(value: string): Promise<void> {
  if (!value || sealed.has(value) || !(await encryptionAvailable())) return;
  try {
    const encrypted = await safeStorage.encryptStringAsync(value);
    sealed.set(value, ENC_PREFIX + encrypted.toString('base64'));
  } catch (error) {
    console.error('Failed to encrypt API key, storing unencrypted:', error);
  }
}

function secrets(store: StoredConfig): string[] {
  return store.profiles.flatMap(p => PROVIDER_IDS.map(id => p.providers[id]?.apiKey ?? ''));
}

function mapSecrets(store: StoredConfig, fn: (v: string) => string): StoredConfig {
  return {
    ...store,
    profiles: store.profiles.map(p => {
      const providers = { ...p.providers };
      for (const id of PROVIDER_IDS) {
        // Files written before a provider existed lack its entry.
        const entry = providers[id] ?? { apiKey: '' };
        providers[id] = { ...entry, apiKey: fn(entry.apiKey ?? '') };
      }
      return { ...p, providers };
    }),
  };
}

async function decryptSecrets(store: StoredConfig): Promise<StoredConfig> {
  const plain = new Map<string, string>();
  for (const value of new Set(secrets(store))) plain.set(value, await decryptSecret(value));
  return mapSecrets(store, v => plain.get(v) ?? '');
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
export async function loadStoredConfig(defaults: Config): Promise<StoredConfig> {
  let raw: Record<string, unknown> | null = null;
  try {
    if (existsSync(configPath)) {
      raw = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }

  if (raw && raw.version === 2) {
    return normalizeStore(await decryptSecrets(raw as unknown as StoredConfig), defaults);
  }

  // Version 1 (or no file): fold the flat config and the plaintext key file
  // into a single profile, persist as v2, and drop the plaintext key file.
  // Keys supplied via environment variables are NOT written to disk: they
  // keep working as a runtime fallback (see getApiKeys in index.ts).
  const legacyKeys = readLegacyApiKeys();
  const store = migrateLegacyConfig(raw ?? {}, defaults, legacyKeys);
  if (raw || existsSync(legacyApiKeysPath)) {
    console.log('Migrating config to profile layout (v2)');
    await saveStoredConfig(store);
    try {
      if (existsSync(legacyApiKeysPath)) unlinkSync(legacyApiKeysPath);
    } catch (error) {
      console.error('Failed to remove legacy apikeys.json:', error);
    }
  }
  return store;
}

// Saves run one after another, so an older snapshot never overwrites a newer
// one while a changed key is being encrypted.
let saving: Promise<void> = Promise.resolve();

/**
 * Write config.json with API keys encrypted. Snapshots `store` now; resolves
 * once the file is written (immediately after any key that changed is
 * encrypted).
 */
export function saveStoredConfig(store: StoredConfig): Promise<void> {
  const snapshot = structuredClone(store);
  saving = saving.then(async () => {
    try {
      for (const value of new Set(secrets(snapshot))) await seal(value);
      // A key that couldn't be encrypted (no OS backend) is stored as-is.
      const onDisk = mapSecrets(snapshot, v => (v ? (sealed.get(v) ?? v) : ''));
      writeFileSync(configPath, JSON.stringify(onDisk, null, 2));
      chmodSync(configPath, 0o600);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  });
  return saving;
}

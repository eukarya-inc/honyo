// Organisation-managed settings (MDM). Values found here are ENFORCED: they
// override whatever the user has in their profile, and the settings window
// shows the affected fields as read-only.
//
// Sources, merged in this order (later wins):
//   1. managed.json          — any OS, pushed as a plain file
//        macOS:   /Library/Application Support/Honyo/managed.json
//        Windows: %ProgramData%\Honyo\managed.json
//        Linux:   /etc/honyo/managed.json
//   2. macOS managed preferences (configuration profile), domain com.rot1024.honyo:
//        /Library/Managed Preferences/com.rot1024.honyo.plist
//        /Library/Managed Preferences/<user>/com.rot1024.honyo.plist
//   3. Windows registry policy: HKLM\SOFTWARE\Policies\Honyo (then HKCU)
//        Nested keys become subkeys, e.g.
//        HKLM\SOFTWARE\Policies\Honyo\providers\anthropic  baseUrl = "https://…"
//
// Schema (all optional):
//   {
//     "providers": { "anthropic"|"openai"|"google"|"xai": { "apiKey"?: string, "baseUrl"?: string } }
//   }
//
// The parsing/merging half of this file is pure so it can be unit tested; the
// loading half touches the file system and shells out to OS tools.
import { existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { homedir, userInfo } from 'os';
import { PROVIDER_IDS } from './profiles.ts';
import type { ProviderId } from './types.ts';

export const MANAGED_BUNDLE_ID = 'com.rot1024.honyo';

export interface ManagedProviderSettings {
  apiKey?: string;
  baseUrl?: string;
}

export interface ManagedConfig {
  providers: Partial<Record<ProviderId, ManagedProviderSettings>>;
}

export const EMPTY_MANAGED: ManagedConfig = { providers: {} };

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

/** Validate an untrusted object into a ManagedConfig (unknown keys ignored). */
export function parseManagedConfig(raw: unknown): ManagedConfig {
  const result: ManagedConfig = { providers: {} };
  if (!raw || typeof raw !== 'object') return result;
  const obj = raw as Record<string, unknown>;

  const providers = obj.providers;
  if (providers && typeof providers === 'object') {
    for (const id of PROVIDER_IDS) {
      const entry = (providers as Record<string, unknown>)[id];
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const apiKey = asString(e.apiKey);
      const baseUrl = asString(e.baseUrl);
      if (apiKey || baseUrl) {
        result.providers[id] = { ...(apiKey ? { apiKey } : {}), ...(baseUrl ? { baseUrl } : {}) };
      }
    }
  }

  return result;
}

/** Later sources override earlier ones field by field. */
export function mergeManagedConfigs(...configs: ManagedConfig[]): ManagedConfig {
  const result: ManagedConfig = { providers: {} };
  for (const c of configs) {
    for (const id of PROVIDER_IDS) {
      const p = c.providers[id];
      if (p) result.providers[id] = { ...(result.providers[id] ?? {}), ...p };
    }
  }
  return result;
}

/**
 * Parse `reg query <root> /s` output into a nested object. Subkey paths
 * below `root` become nested objects; REG_DWORD values become numbers.
 */
export function parseRegistryQuery(output: string, root: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let current: Record<string, unknown> = result;
  const rootLower = root.toLowerCase();
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    if (!line.startsWith(' ')) {
      // Key path line.
      const path = line.trim();
      if (!path.toLowerCase().startsWith(rootLower)) continue;
      const rel = path.slice(root.length).replace(/^\\/, '');
      current = result;
      if (rel) {
        for (const part of rel.split('\\')) {
          const next = (current[part] as Record<string, unknown> | undefined) ?? {};
          current[part] = next;
          current = next;
        }
      }
      continue;
    }
    // Value line: "    name    REG_SZ    value"
    const m = /^\s+(.+?)\s{2,}(REG_[A-Z_]+)\s{2,}(.*)$/.exec(line);
    if (!m) continue;
    const [, name, type, value] = m;
    if (!name || !value) continue;
    current[name] = type === 'REG_DWORD' ? parseInt(value, 16) : value;
  }
  return result;
}

// --- Loading -------------------------------------------------------------------

function readJsonFile(path: string): unknown {
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    console.error(`Failed to read managed config ${path}:`, error);
  }
  return null;
}

function readPlist(path: string): unknown {
  try {
    if (!existsSync(path)) return null;
    const json = execFileSync('plutil', ['-convert', 'json', '-o', '-', path], {
      encoding: 'utf8',
      timeout: 3000,
    });
    return JSON.parse(json) as unknown;
  } catch (error) {
    console.error(`Failed to read managed preferences ${path}:`, error);
    return null;
  }
}

function readRegistry(root: string): unknown {
  try {
    const output = execFileSync('reg', ['query', root, '/s'], { encoding: 'utf8', timeout: 3000 });
    return parseRegistryQuery(output, root);
  } catch {
    // Key absent (the common case) or reg.exe unavailable.
    return null;
  }
}

export function managedJsonPath(platform = process.platform): string {
  switch (platform) {
    case 'darwin':
      return '/Library/Application Support/Honyo/managed.json';
    case 'win32':
      return join(process.env.ProgramData ?? 'C:\\ProgramData', 'Honyo', 'managed.json');
    default:
      return '/etc/honyo/managed.json';
  }
}

/** Read and merge every managed source available on this machine. */
export function loadManagedConfig(): ManagedConfig {
  // Dev aid: HONYO_MANAGED_JSON points at a managed.json to test with.
  const sources: unknown[] = [readJsonFile(process.env.HONYO_MANAGED_JSON ?? managedJsonPath())];

  if (process.platform === 'darwin') {
    sources.push(readPlist(`/Library/Managed Preferences/${MANAGED_BUNDLE_ID}.plist`));
    const user = userInfo().username;
    sources.push(readPlist(`/Library/Managed Preferences/${user}/${MANAGED_BUNDLE_ID}.plist`));
  } else if (process.platform === 'win32') {
    sources.push(readRegistry('HKLM\\SOFTWARE\\Policies\\Honyo'));
    sources.push(readRegistry('HKCU\\SOFTWARE\\Policies\\Honyo'));
  } else {
    sources.push(readJsonFile(join(homedir(), '.config', 'honyo', 'managed.json')));
  }

  const merged = mergeManagedConfigs(...sources.filter(Boolean).map(parseManagedConfig));
  const managedProviders = Object.keys(merged.providers);
  if (managedProviders.length > 0) {
    console.log('Managed configuration active for providers:', managedProviders);
  }
  return merged;
}

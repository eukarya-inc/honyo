// Pure, electron-free profile logic: migration from the flat v1 config, the
// split between profile-scoped and global updates, and profile CRUD rules.
import type {
  ApiKeys,
  Config,
  GlobalSettings,
  LegacyConfig,
  Profile,
  ProfileSettings,
  ProviderId,
  StoredConfig,
} from './types.ts';

export const PROVIDER_IDS: ProviderId[] = ['anthropic', 'openai', 'google', 'xai'];

export const DEFAULT_PROFILE_NAME = 'Default';

const PROFILE_KEYS = [
  'targetLanguage',
  'secondaryLanguage',
  'aiModel',
  'customModel',
  'customPrompt',
  'customLanguages',
  'shortcut',
] as const satisfies ReadonlyArray<keyof Omit<ProfileSettings, 'providers'>>;

type ProfileKey = (typeof PROFILE_KEYS)[number];

export function isProfileKey(key: string): key is ProfileKey {
  return (PROFILE_KEYS as readonly string[]).includes(key);
}

export function newProfileId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyProviders(keys?: Partial<ApiKeys>): Profile['providers'] {
  return {
    anthropic: { apiKey: keys?.anthropic ?? '' },
    openai: { apiKey: keys?.openai ?? '' },
    google: { apiKey: keys?.google ?? '' },
    xai: { apiKey: keys?.xai ?? '' },
  };
}

/** Build a profile from flat profile settings (used for defaults and migration). */
export function buildProfile(
  name: string,
  settings: Omit<ProfileSettings, 'providers'>,
  keys?: Partial<ApiKeys>,
  id = newProfileId(),
): Profile {
  return { id, name, ...settings, providers: emptyProviders(keys) };
}

/** Split a flat Config update into the profile part and the global part. */
export function splitUpdates(updates: Partial<Config>): {
  profile: Partial<Omit<ProfileSettings, 'providers'>>;
  global: Partial<GlobalSettings>;
} {
  const profile: Record<string, unknown> = {};
  const global: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    (isProfileKey(key) ? profile : global)[key] = value;
  }
  return {
    profile: profile as Partial<Omit<ProfileSettings, 'providers'>>,
    global: global as Partial<GlobalSettings>,
  };
}

/** Merge global settings with the active profile into the flat Config view. */
export function toFlatConfig(store: StoredConfig, profile: Profile): Config {
  const global: Record<string, unknown> = { ...store };
  delete global.version;
  delete global.activeProfileId;
  delete global.profiles;
  const settings: Record<string, unknown> = { ...profile };
  delete settings.id;
  delete settings.name;
  delete settings.providers;
  return { ...global, ...settings } as unknown as Config;
}

/**
 * Convert a version-1 flat config (+ its separately stored API keys) into a
 * version-2 store with a single profile carrying the old settings.
 */
export function migrateLegacyConfig(
  legacy: LegacyConfig,
  defaults: Config,
  apiKeys: Partial<ApiKeys>,
): StoredConfig {
  const flat: Config = { ...defaults, ...legacy };
  if (legacy.fallbackLanguage && !legacy.secondaryLanguage) {
    flat.secondaryLanguage = legacy.fallbackLanguage;
  }
  const { profile: profileSettings, global } = splitUpdates(flat);
  const profile = buildProfile(
    DEFAULT_PROFILE_NAME,
    { ...pickProfileDefaults(defaults), ...profileSettings },
    apiKeys,
  );
  return {
    ...(global as GlobalSettings),
    version: 2,
    activeProfileId: profile.id,
    profiles: [profile],
  };
}

export function pickProfileDefaults(defaults: Config): Omit<ProfileSettings, 'providers'> {
  return {
    targetLanguage: defaults.targetLanguage,
    secondaryLanguage: defaults.secondaryLanguage,
    aiModel: defaults.aiModel,
    customPrompt: defaults.customPrompt,
    ...(defaults.customModel ? { customModel: defaults.customModel } : {}),
    ...(defaults.customLanguages ? { customLanguages: defaults.customLanguages } : {}),
  };
}

/**
 * Repair a loaded store: guarantee at least one profile, a valid active id,
 * and complete provider entries (older v2 files may lack a provider).
 */
export function normalizeStore(store: StoredConfig, defaults: Config): StoredConfig {
  const profiles = (store.profiles ?? []).map(p => ({
    ...p,
    providers: { ...emptyProviders(), ...(p.providers ?? {}) },
  }));
  if (profiles.length === 0) {
    profiles.push(buildProfile(DEFAULT_PROFILE_NAME, pickProfileDefaults(defaults)));
  }
  const activeProfileId = profiles.some(p => p.id === store.activeProfileId)
    ? store.activeProfileId
    : (profiles[0]?.id ?? '');
  return { ...store, version: 2, profiles, activeProfileId };
}

/** Pick a name that does not collide with existing profile names. */
export function uniqueProfileName(name: string, profiles: Profile[], exceptId?: string): string {
  const taken = new Set(profiles.filter(p => p.id !== exceptId).map(p => p.name));
  const base = name.trim() || DEFAULT_PROFILE_NAME;
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Deep-copy a profile under a new id and name (API keys are copied too). */
export function duplicateProfile(source: Profile, name: string): Profile {
  return {
    ...structuredClone(source),
    id: newProfileId(),
    name,
  };
}

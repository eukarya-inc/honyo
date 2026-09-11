import { describe, it, expect } from 'vitest';
import {
  buildProfile,
  duplicateProfile,
  migrateLegacyConfig,
  normalizeStore,
  splitUpdates,
  toFlatConfig,
  uniqueProfileName,
} from './profiles.ts';
import type { Config, StoredConfig } from './types.ts';

const defaults: Config = {
  targetLanguage: 'Japanese',
  secondaryLanguage: 'English',
  isPaused: false,
  aiModel: 'default',
  autoCloseOnBlur: true,
  enableStreaming: true,
  customPrompt: '',
  displayMode: 'notification',
  popupFontSize: 14,
};

describe('splitUpdates', () => {
  it('routes profile keys and global keys separately', () => {
    const { profile, global } = splitUpdates({
      targetLanguage: 'French',
      customPrompt: 'formal',
      displayMode: 'popup',
      popupFontSize: 16,
    });
    expect(profile).toEqual({ targetLanguage: 'French', customPrompt: 'formal' });
    expect(global).toEqual({ displayMode: 'popup', popupFontSize: 16 });
  });
});

describe('migrateLegacyConfig', () => {
  it('moves flat settings and api keys into a single Default profile', () => {
    const store = migrateLegacyConfig(
      { targetLanguage: 'German', customPrompt: 'be brief', displayMode: 'popup', isPaused: true },
      defaults,
      { openai: 'sk-test' },
    );
    expect(store.version).toBe(2);
    expect(store.profiles).toHaveLength(1);
    const p = store.profiles[0]!;
    expect(store.activeProfileId).toBe(p.id);
    expect(p.name).toBe('Default');
    expect(p.targetLanguage).toBe('German');
    expect(p.secondaryLanguage).toBe('English');
    expect(p.customPrompt).toBe('be brief');
    expect(p.providers.openai.apiKey).toBe('sk-test');
    expect(p.providers.anthropic.apiKey).toBe('');
    expect(store.displayMode).toBe('popup');
    expect(store.isPaused).toBe(true);
    expect(store).not.toHaveProperty('targetLanguage');
  });

  it('honours the pre-v1 fallbackLanguage field', () => {
    const store = migrateLegacyConfig({ fallbackLanguage: 'Korean' }, defaults, {});
    expect(store.profiles[0]?.secondaryLanguage).toBe('Korean');
  });
});

describe('toFlatConfig', () => {
  it('merges global settings with the profile and hides providers', () => {
    const profile = buildProfile('Work', {
      targetLanguage: 'English',
      secondaryLanguage: 'Japanese',
      aiModel: 'gpt-4o-mini',
      customPrompt: 'x',
    });
    const store: StoredConfig = {
      version: 2,
      activeProfileId: profile.id,
      profiles: [profile],
      isPaused: false,
      displayMode: 'popup',
    };
    const flat = toFlatConfig(store, profile);
    expect(flat).toEqual({
      isPaused: false,
      displayMode: 'popup',
      targetLanguage: 'English',
      secondaryLanguage: 'Japanese',
      aiModel: 'gpt-4o-mini',
      customPrompt: 'x',
    });
  });
});

describe('normalizeStore', () => {
  it('creates a default profile when none exist and fixes the active id', () => {
    const store = normalizeStore(
      {
        version: 2,
        activeProfileId: 'missing',
        profiles: [],
        isPaused: false,
        displayMode: 'notification',
      },
      defaults,
    );
    expect(store.profiles).toHaveLength(1);
    expect(store.activeProfileId).toBe(store.profiles[0]?.id);
  });

  it('fills in missing provider entries', () => {
    const p = buildProfile('A', defaults);
    // @ts-expect-error simulate an older file lacking a provider
    delete p.providers.google;
    const store = normalizeStore(
      {
        version: 2,
        activeProfileId: p.id,
        profiles: [p],
        isPaused: false,
        displayMode: 'notification',
      },
      defaults,
    );
    expect(store.profiles[0]?.providers.google).toEqual({ apiKey: '' });
  });
});

describe('uniqueProfileName / duplicateProfile', () => {
  it('appends a counter when the name is taken', () => {
    const a = buildProfile('Work', defaults);
    const b = buildProfile('Work 2', defaults);
    expect(uniqueProfileName('Work', [a, b])).toBe('Work 3');
    expect(uniqueProfileName('Work', [a, b], a.id)).toBe('Work');
    expect(uniqueProfileName('   ', [])).toBe('Default');
  });

  it('duplicates with a fresh id and copied keys', () => {
    const a = buildProfile('Work', defaults, { anthropic: 'k' });
    const copy = duplicateProfile(a, 'Work copy');
    expect(copy.id).not.toBe(a.id);
    expect(copy.name).toBe('Work copy');
    expect(copy.providers.anthropic.apiKey).toBe('k');
    copy.providers.anthropic.apiKey = 'changed';
    expect(a.providers.anthropic.apiKey).toBe('k');
  });
});

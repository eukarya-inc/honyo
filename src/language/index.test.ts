import { describe, it, expect } from 'vitest';
import { getLanguageFromLocale } from './index.ts';

describe('getLanguageFromLocale', () => {
  it('should return exact match for known locale', () => {
    expect(getLanguageFromLocale('ja')).toBe('Japanese');
    expect(getLanguageFromLocale('en')).toBe('English');
    expect(getLanguageFromLocale('ko')).toBe('Korean');
  });

  it('should extract language code from locale', () => {
    expect(getLanguageFromLocale('ja-JP')).toBe('Japanese');
    expect(getLanguageFromLocale('en-US')).toBe('English');
    expect(getLanguageFromLocale('fr-FR')).toBe('French');
  });

  it('maps locales of the languages added for PLaMo', () => {
    expect(getLanguageFromLocale('he')).toBe('Hebrew');
    expect(getLanguageFromLocale('uk-UA')).toBe('Ukrainian');
    expect(getLanguageFromLocale('fa-IR')).toBe('Persian');
  });

  it('should handle Chinese locales correctly', () => {
    expect(getLanguageFromLocale('zh-CN')).toBe('Chinese (Simplified)');
    expect(getLanguageFromLocale('zh-TW')).toBe('Chinese (Traditional)');
    expect(getLanguageFromLocale('zh-HK')).toBe('Chinese (Traditional)');
    expect(getLanguageFromLocale('zh')).toBe('Chinese (Simplified)');
  });

  it('should default to English for unknown locales', () => {
    expect(getLanguageFromLocale('unknown')).toBe('English');
    expect(getLanguageFromLocale('xyz-ABC')).toBe('English');
  });
});

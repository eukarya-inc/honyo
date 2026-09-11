import { describe, it, expect } from 'vitest';
import { mergeManagedConfigs, parseManagedConfig, parseRegistryQuery } from './managed.ts';

describe('parseManagedConfig', () => {
  it('accepts provider keys and base URLs, ignoring junk', () => {
    const c = parseManagedConfig({
      providers: {
        anthropic: { apiKey: ' sk-a ', baseUrl: 'https://gw.example/anthropic' },
        openai: { baseUrl: 'https://gw.example/openai', extra: 1 },
        bogus: { apiKey: 'x' },
      },
      somethingElse: true,
    });
    expect(c).toEqual({
      providers: {
        anthropic: { apiKey: 'sk-a', baseUrl: 'https://gw.example/anthropic' },
        openai: { baseUrl: 'https://gw.example/openai' },
      },
    });
  });

  it('returns an empty config for non-objects and drops empty provider entries', () => {
    expect(parseManagedConfig(null)).toEqual({ providers: {} });
    expect(parseManagedConfig({ providers: { google: { apiKey: '' } } })).toEqual({
      providers: {},
    });
  });
});

describe('mergeManagedConfigs', () => {
  it('lets later sources override field by field', () => {
    const merged = mergeManagedConfigs(
      { providers: { xai: { apiKey: 'k1', baseUrl: 'u1' } } },
      { providers: { xai: { baseUrl: 'u2' } } },
    );
    expect(merged).toEqual({ providers: { xai: { apiKey: 'k1', baseUrl: 'u2' } } });
  });
});

describe('parseRegistryQuery', () => {
  it('turns reg query output into a nested object', () => {
    const output = [
      '',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Honyo',
      '    enabled    REG_DWORD    0x1',
      '',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Honyo\\providers',
      '',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Honyo\\providers\\anthropic',
      '    baseUrl    REG_SZ    https://gw.example/anthropic',
      '    apiKey    REG_SZ    sk-managed',
      '',
    ].join('\r\n');
    const parsed = parseRegistryQuery(output, 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Honyo');
    expect(parsed).toEqual({
      enabled: 1,
      providers: {
        anthropic: { baseUrl: 'https://gw.example/anthropic', apiKey: 'sk-managed' },
      },
    });
    expect(parseManagedConfig(parsed)).toEqual({
      providers: { anthropic: { baseUrl: 'https://gw.example/anthropic', apiKey: 'sk-managed' } },
    });
  });
});

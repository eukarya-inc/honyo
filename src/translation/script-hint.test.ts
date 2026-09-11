import { describe, it, expect } from 'vitest';
import { detectScriptHint } from './script-hint.ts';

describe('detectScriptHint', () => {
  it('flags Japanese when kana is present even with many Latin letters', () => {
    expect(detectScriptHint('HonyoはSREチームがメンテできる')).toContain('Japanese');
  });

  it('prefers Japanese over Chinese when kana and Han both appear', () => {
    expect(detectScriptHint('東京に行きます')).toContain('Japanese');
  });

  it('flags Chinese for Han-only text', () => {
    expect(detectScriptHint('我们去东京')).toContain('Chinese');
  });

  it('flags Korean for Hangul', () => {
    expect(detectScriptHint('SRE 팀이 유지보수할 수 있다')).toContain('Korean');
  });

  it('flags Cyrillic script', () => {
    expect(detectScriptHint('Команда SRE может это поддерживать')).toContain('Cyrillic');
  });

  it('returns undefined for pure Latin text', () => {
    expect(detectScriptHint('The SRE team can maintain Honyo')).toBeUndefined();
  });

  it('returns undefined for empty input', () => {
    expect(detectScriptHint('')).toBeUndefined();
  });
});

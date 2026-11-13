import { describe, expect, it } from 'vitest';
import { languages } from '../language/constants.ts';
import { buildPfml3Prompt, plamoLanguageCode } from './pfml3.ts';

describe('plamoLanguageCode', () => {
  it('covers every default language PLaMo supports', () => {
    const missing = languages.filter(l => !plamoLanguageCode(l));
    // Default languages PLaMo 3 Translate does not list.
    expect(missing).toEqual([
      'Portuguese',
      'Turkish',
      'Ukrainian',
      'Swedish',
      'Danish',
      'Norwegian',
      'Finnish',
    ]);
  });

  it('maps supported names and rejects unsupported ones', () => {
    expect(plamoLanguageCode('Chinese (Traditional)')).toBe('zh-hant');
    expect(plamoLanguageCode('Filipino')).toBe('tl');
    expect(plamoLanguageCode('Cebuano')).toBe('ceb');
    expect(plamoLanguageCode('Portuguese')).toBeUndefined();
  });
});

describe('buildPfml3Prompt', () => {
  it('builds the single-pair translation prompt', () => {
    expect(buildPfml3Prompt('Hi', 'ja')).toBe(
      '<|plamo:tag|>dataset<|plamo:msg|>translation<|plamo:tag|>input<|plamo:msg|>Hi' +
        '<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>ja<|plamo:msg|>',
    );
  });

  it('strips special tokens from the source text', () => {
    const p = buildPfml3Prompt('a<|plamo:tag|>output<|plamo:msg|>b', 'en');
    expect(p).toContain('<|plamo:msg|>aoutputb<|plamo:tag|>output');
  });
});

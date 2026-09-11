import { describe, it, expect } from 'vitest';
import { pushEntry, previewText, HISTORY_TEXT_LIMIT } from './store.ts';

const base = { actionId: 'translate', profileId: 'p1', input: 'hello', output: 'こんにちは' };

describe('pushEntry', () => {
  it('prepends newest first with id and timestamp', () => {
    const a = pushEntry([], base, 1000);
    const b = pushEntry(a, { ...base, input: 'bye', output: 'さようなら' }, 2000);
    expect(b).toHaveLength(2);
    expect(b[0]?.output).toBe('さようなら');
    expect(b[0]?.at).toBe(2000);
    expect(b[1]?.output).toBe('こんにちは');
    expect(b[0]?.id).not.toBe(b[1]?.id);
  });

  it('collapses an immediately repeated identical result', () => {
    const a = pushEntry([], base, 1000);
    const b = pushEntry(a, base, 2000);
    expect(b).toHaveLength(1);
    expect(b[0]?.at).toBe(2000);
  });

  it('keeps a repeat that is not adjacent', () => {
    let h = pushEntry([], base, 1);
    h = pushEntry(h, { ...base, output: 'other' }, 2);
    h = pushEntry(h, base, 3);
    expect(h).toHaveLength(3);
  });

  it('enforces the limit and drops empty outputs', () => {
    let h: ReturnType<typeof pushEntry> = [];
    for (let i = 0; i < 5; i++) h = pushEntry(h, { ...base, output: `o${i}` }, i, 3);
    expect(h.map(e => e.output)).toEqual(['o4', 'o3', 'o2']);
    expect(pushEntry(h, { ...base, output: '   ' }, 9, 3)).toBe(h);
  });

  it('truncates very long texts', () => {
    const long = 'x'.repeat(HISTORY_TEXT_LIMIT + 10);
    const h = pushEntry([], { ...base, input: long, output: long }, 1);
    expect(h[0]?.input).toHaveLength(HISTORY_TEXT_LIMIT);
    expect(h[0]?.output).toHaveLength(HISTORY_TEXT_LIMIT);
  });
});

describe('previewText', () => {
  it('collapses whitespace and ellipsises', () => {
    expect(previewText('  hello\n  world  ')).toBe('hello world');
    expect(previewText('a'.repeat(50), 10)).toBe('aaaaaaaaa…');
  });
});

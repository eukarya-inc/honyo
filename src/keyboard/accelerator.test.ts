import { describe, it, expect } from 'vitest';
import {
  acceleratorFromEvent,
  formatAccelerator,
  isValidAccelerator,
  keyNameFromEvent,
} from './accelerator.ts';

type Mods = Partial<Record<'meta' | 'ctrl' | 'alt' | 'shift', boolean>>;
const ev = (
  code: string,
  mods: Mods = {},
): {
  code: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
} => ({
  code,
  key: '',
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  altKey: mods.alt ?? false,
  shiftKey: mods.shift ?? false,
});

describe('keyNameFromEvent', () => {
  it('maps letters, digits, function keys and named keys', () => {
    expect(keyNameFromEvent(ev('KeyT'))).toBe('T');
    expect(keyNameFromEvent(ev('Digit3'))).toBe('3');
    expect(keyNameFromEvent(ev('F5'))).toBe('F5');
    expect(keyNameFromEvent(ev('ArrowUp'))).toBe('Up');
    expect(keyNameFromEvent(ev('Comma'))).toBe(',');
  });

  it('ignores modifier-only presses', () => {
    expect(keyNameFromEvent(ev('MetaLeft'))).toBeNull();
    expect(keyNameFromEvent(ev('ShiftRight'))).toBeNull();
  });
});

describe('acceleratorFromEvent', () => {
  it('uses Command on macOS and Super elsewhere for the meta key', () => {
    expect(acceleratorFromEvent(ev('KeyT', { meta: true, shift: true }), 'darwin')).toBe(
      'Command+Shift+T',
    );
    expect(acceleratorFromEvent(ev('KeyT', { meta: true }), 'win32')).toBe('Super+T');
    expect(acceleratorFromEvent(ev('KeyT', { ctrl: true, alt: true }), 'linux')).toBe(
      'Control+Alt+T',
    );
  });

  it('rejects bare keys and modifier-only presses', () => {
    expect(acceleratorFromEvent(ev('KeyT'), 'darwin')).toBeNull();
    expect(acceleratorFromEvent(ev('MetaLeft', { meta: true }), 'darwin')).toBeNull();
  });
});

describe('formatAccelerator', () => {
  it('renders macOS symbols and plain words elsewhere', () => {
    expect(formatAccelerator('Command+Shift+T', 'darwin')).toBe('⌘⇧T');
    expect(formatAccelerator('Control+Alt+T', 'win32')).toBe('Control + Alt + T');
    expect(formatAccelerator('', 'darwin')).toBe('');
  });
});

describe('isValidAccelerator', () => {
  it('requires at least one modifier and a key', () => {
    expect(isValidAccelerator('Command+Shift+T')).toBe(true);
    expect(isValidAccelerator('CommandOrControl+1')).toBe(true);
    expect(isValidAccelerator('T')).toBe(false);
    expect(isValidAccelerator('Command+Shift')).toBe(false);
    expect(isValidAccelerator('Bogus+T')).toBe(false);
  });
});

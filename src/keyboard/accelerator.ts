// Pure helpers for Electron accelerator strings ("Command+Shift+T"), shared by
// the settings renderer (recording a shortcut) and the main process
// (validating / displaying it). No electron imports.

export interface KeyLike {
  code: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

// KeyboardEvent.code -> Electron key name.
const CODE_TO_KEY: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Escape: 'Escape',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Backquote: '`',
};

const MODIFIER_CODES = /^(Meta|Control|Alt|Shift|OS|CapsLock|Fn)/;

/** Electron key name for a KeyboardEvent, or null for modifier-only presses. */
export function keyNameFromEvent(e: Pick<KeyLike, 'code' | 'key'>): string | null {
  if (MODIFIER_CODES.test(e.code)) return null;
  const mapped = CODE_TO_KEY[e.code];
  if (mapped) return mapped;
  const letter = /^Key([A-Z])$/.exec(e.code);
  if (letter) return letter[1] ?? null;
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  if (digit) return digit[1] ?? null;
  const fn = /^(F\d{1,2})$/.exec(e.code);
  if (fn) return fn[1] ?? null;
  return null;
}

/**
 * Build an accelerator from a key event. Returns null when the press is a
 * modifier alone or has no modifier at all (a bare key cannot be a global
 * shortcut without hijacking normal typing).
 */
export function acceleratorFromEvent(e: KeyLike, platform: string): string | null {
  const key = keyNameFromEvent(e);
  if (!key) return null;
  const mods: string[] = [];
  if (e.ctrlKey) mods.push('Control');
  if (e.metaKey) mods.push(platform === 'darwin' ? 'Command' : 'Super');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  if (mods.length === 0) return null;
  return [...mods, key].join('+');
}

/** Human-readable form for display: symbols on macOS, words elsewhere. */
export function formatAccelerator(accelerator: string, platform: string): string {
  if (!accelerator) return '';
  const parts = accelerator.split('+');
  if (platform !== 'darwin') return parts.join(' + ');
  const sym: Record<string, string> = {
    Command: '⌘',
    CommandOrControl: '⌘',
    CmdOrCtrl: '⌘',
    Control: '⌃',
    Alt: '⌥',
    Option: '⌥',
    Shift: '⇧',
    Up: '↑',
    Down: '↓',
    Left: '←',
    Right: '→',
    Enter: '↩',
    Backspace: '⌫',
    Delete: '⌦',
    Escape: '⎋',
    Space: '␣',
  };
  return parts.map(p => sym[p] ?? p).join('');
}

/** True when the string looks like "Mod(+Mod)*+Key". */
export function isValidAccelerator(accelerator: string): boolean {
  const parts = accelerator.split('+');
  if (parts.length < 2) return false;
  const mods = new Set([
    'Command',
    'Cmd',
    'Control',
    'Ctrl',
    'CommandOrControl',
    'CmdOrCtrl',
    'Alt',
    'Option',
    'AltGr',
    'Shift',
    'Super',
    'Meta',
  ]);
  const key = parts[parts.length - 1] ?? '';
  return parts.slice(0, -1).every(p => mods.has(p)) && key.length > 0 && !mods.has(key);
}

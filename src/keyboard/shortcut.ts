import { UiohookKey, type UiohookKeyboardEvent } from 'uiohook-napi';
import type { ShortcutConfig } from '../config/types.ts';

// Default: Double Cmd+C (Mac) / Ctrl+C (Win/Linux)
export function getDefaultShortcut(): ShortcutConfig {
  return {
    keycode: UiohookKey.C,
    ctrlKey: process.platform !== 'darwin',
    metaKey: process.platform === 'darwin',
    altKey: false,
    shiftKey: false,
    doublePress: true,
  };
}

// Check if key event matches shortcut config
export function matchesShortcut(event: UiohookKeyboardEvent, config: ShortcutConfig): boolean {
  return (
    event.keycode === config.keycode &&
    event.ctrlKey === config.ctrlKey &&
    event.metaKey === config.metaKey &&
    event.altKey === config.altKey &&
    event.shiftKey === config.shiftKey
  );
}

// Format shortcut for display (e.g., "Cmd+C", "Ctrl+Shift+T")
export function formatShortcut(config: ShortcutConfig): string {
  const parts: string[] = [];
  if (config.ctrlKey) parts.push('Ctrl');
  if (config.metaKey) parts.push('Cmd');
  if (config.altKey) parts.push('Alt');
  if (config.shiftKey) parts.push('Shift');
  parts.push(getKeyName(config.keycode));
  return parts.join('+');
}

// Keycode to display name
function getKeyName(keycode: number): string {
  const keyMap: Record<number, string> = {};
  for (const [name, code] of Object.entries(UiohookKey)) {
    if (typeof code === 'number') {
      keyMap[code] = name;
    }
  }
  return keyMap[keycode] ?? `Key${keycode}`;
}

// DOM KeyboardEvent.code to uiohook keycode mapping
const domCodeToUiohook: Record<string, number> = {
  // Letters
  KeyA: UiohookKey.A,
  KeyB: UiohookKey.B,
  KeyC: UiohookKey.C,
  KeyD: UiohookKey.D,
  KeyE: UiohookKey.E,
  KeyF: UiohookKey.F,
  KeyG: UiohookKey.G,
  KeyH: UiohookKey.H,
  KeyI: UiohookKey.I,
  KeyJ: UiohookKey.J,
  KeyK: UiohookKey.K,
  KeyL: UiohookKey.L,
  KeyM: UiohookKey.M,
  KeyN: UiohookKey.N,
  KeyO: UiohookKey.O,
  KeyP: UiohookKey.P,
  KeyQ: UiohookKey.Q,
  KeyR: UiohookKey.R,
  KeyS: UiohookKey.S,
  KeyT: UiohookKey.T,
  KeyU: UiohookKey.U,
  KeyV: UiohookKey.V,
  KeyW: UiohookKey.W,
  KeyX: UiohookKey.X,
  KeyY: UiohookKey.Y,
  KeyZ: UiohookKey.Z,
  // Numbers
  Digit0: UiohookKey['0'],
  Digit1: UiohookKey['1'],
  Digit2: UiohookKey['2'],
  Digit3: UiohookKey['3'],
  Digit4: UiohookKey['4'],
  Digit5: UiohookKey['5'],
  Digit6: UiohookKey['6'],
  Digit7: UiohookKey['7'],
  Digit8: UiohookKey['8'],
  Digit9: UiohookKey['9'],
  // Function keys
  F1: UiohookKey.F1,
  F2: UiohookKey.F2,
  F3: UiohookKey.F3,
  F4: UiohookKey.F4,
  F5: UiohookKey.F5,
  F6: UiohookKey.F6,
  F7: UiohookKey.F7,
  F8: UiohookKey.F8,
  F9: UiohookKey.F9,
  F10: UiohookKey.F10,
  F11: UiohookKey.F11,
  F12: UiohookKey.F12,
  // Special keys
  Escape: UiohookKey.Escape,
  Tab: UiohookKey.Tab,
  Space: UiohookKey.Space,
  Enter: UiohookKey.Enter,
  Backspace: UiohookKey.Backspace,
  Delete: UiohookKey.Delete,
  Insert: UiohookKey.Insert,
  Home: UiohookKey.Home,
  End: UiohookKey.End,
  PageUp: UiohookKey.PageUp,
  PageDown: UiohookKey.PageDown,
  ArrowUp: UiohookKey.ArrowUp,
  ArrowDown: UiohookKey.ArrowDown,
  ArrowLeft: UiohookKey.ArrowLeft,
  ArrowRight: UiohookKey.ArrowRight,
  // Punctuation
  Minus: UiohookKey.Minus,
  Equal: UiohookKey.Equal,
  BracketLeft: UiohookKey.BracketLeft,
  BracketRight: UiohookKey.BracketRight,
  Backslash: UiohookKey.Backslash,
  Semicolon: UiohookKey.Semicolon,
  Quote: UiohookKey.Quote,
  Backquote: UiohookKey.Backquote,
  Comma: UiohookKey.Comma,
  Period: UiohookKey.Period,
  Slash: UiohookKey.Slash,
};

export function domCodeToKeycode(code: string): number {
  return domCodeToUiohook[code] ?? 0;
}

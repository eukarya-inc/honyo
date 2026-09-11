// Global shortcut registration: the custom translate trigger and per-profile
// activation shortcuts. Re-run whenever config changes; safe to call often.
import { globalShortcut, Notification } from 'electron';
import { getConfig, listProfiles, setActiveProfile } from '../config/index.ts';
import { isValidAccelerator, formatAccelerator } from './accelerator.ts';
import { triggerTranslation } from './handler.ts';

export interface ShortcutProblem {
  accelerator: string;
  purpose: string;
}

let lastProblems: ShortcutProblem[] = [];

function tryRegister(accelerator: string, purpose: string, action: () => void): boolean {
  if (!isValidAccelerator(accelerator)) {
    lastProblems.push({ accelerator, purpose });
    return false;
  }
  try {
    if (globalShortcut.isRegistered(accelerator) || !globalShortcut.register(accelerator, action)) {
      lastProblems.push({ accelerator, purpose });
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Failed to register shortcut ${accelerator}:`, error);
    lastProblems.push({ accelerator, purpose });
    return false;
  }
}

/** (Re)register every configured global shortcut. Returns what could not be registered. */
export function registerShortcuts(): ShortcutProblem[] {
  globalShortcut.unregisterAll();
  lastProblems = [];

  const config = getConfig();
  const shortcuts = config.shortcuts;
  if (shortcuts?.translateTrigger === 'shortcut' && shortcuts.translateShortcut) {
    tryRegister(shortcuts.translateShortcut, 'Translate', () => {
      void triggerTranslation({
        copySelectionFirst: shortcuts.translateSource !== 'clipboard',
      });
    });
  }

  for (const profile of listProfiles()) {
    if (!profile.shortcut) continue;
    tryRegister(profile.shortcut, `Profile "${profile.name}"`, () => {
      if (setActiveProfile(profile.id)) {
        new Notification({ title: 'Honyo', body: `Profile: ${profile.name}` }).show();
      }
    });
  }

  if (lastProblems.length > 0) {
    const lines = lastProblems.map(
      p => `${p.purpose}: ${formatAccelerator(p.accelerator, process.platform)}`,
    );
    console.warn('Shortcuts not registered:', lines);
    new Notification({
      title: 'Shortcut not available',
      body: `Already in use or invalid:\n${lines.join('\n')}`,
    }).show();
  }
  return lastProblems;
}

export function getShortcutProblems(): ShortcutProblem[] {
  return lastProblems;
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}

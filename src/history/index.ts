// Persistent history of action results (history.json in userData).
import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { pushEntry, type HistoryEntry, type NewHistoryEntry } from './store.ts';

let entries: HistoryEntry[] | null = null;
const listeners: Array<() => void> = [];

function historyPath(): string {
  return join(app.getPath('userData'), 'history.json');
}

function load(): HistoryEntry[] {
  if (entries) return entries;
  try {
    if (existsSync(historyPath())) {
      const parsed = JSON.parse(readFileSync(historyPath(), 'utf8')) as unknown;
      entries = Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
    } else {
      entries = [];
    }
  } catch (error) {
    console.error('Failed to load history:', error);
    entries = [];
  }
  return entries;
}

function save(): void {
  try {
    writeFileSync(historyPath(), JSON.stringify(entries ?? [], null, 2));
    // Results can contain anything the user copied: owner-only permissions.
    chmodSync(historyPath(), 0o600);
  } catch (error) {
    console.error('Failed to save history:', error);
  }
}

function changed(): void {
  save();
  for (const l of listeners) l();
}

/** Register a callback for history changes (tray menu rebuild). */
export function onHistoryChanged(listener: () => void): void {
  listeners.push(listener);
}

export function listHistory(): HistoryEntry[] {
  return load();
}

export function addHistoryEntry(entry: NewHistoryEntry): void {
  entries = pushEntry(load(), entry);
  changed();
}

export function removeHistoryEntry(id: string): void {
  entries = load().filter(e => e.id !== id);
  changed();
}

export function clearHistory(): void {
  entries = [];
  changed();
}

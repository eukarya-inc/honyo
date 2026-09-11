// Pure, electron-free history model: a bounded, newest-first list of action
// results, Clipy-style. Persistence lives in index.ts.

export interface HistoryEntry {
  id: string;
  /** Unix ms. */
  at: number;
  actionId: string;
  profileId: string;
  input: string;
  output: string;
  meta?: { sourceLanguage?: string; targetLanguage?: string };
}

export type NewHistoryEntry = Omit<HistoryEntry, 'id' | 'at'>;

export const HISTORY_LIMIT = 100;
/** Inputs/outputs longer than this are truncated before storing. */
export const HISTORY_TEXT_LIMIT = 20_000;

export function newHistoryId(): string {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clip(text: string): string {
  return text.length > HISTORY_TEXT_LIMIT ? text.slice(0, HISTORY_TEXT_LIMIT) : text;
}

/**
 * Prepend an entry, dropping an immediately preceding duplicate (same action,
 * input and output) and enforcing the size limit. Returns a new array.
 */
export function pushEntry(
  entries: HistoryEntry[],
  entry: NewHistoryEntry,
  now = Date.now(),
  limit = HISTORY_LIMIT,
): HistoryEntry[] {
  const output = clip(entry.output);
  if (!output.trim()) return entries;
  const next: HistoryEntry = {
    ...entry,
    input: clip(entry.input),
    output,
    id: newHistoryId(),
    at: now,
  };
  const head = entries[0];
  const rest =
    head && head.actionId === next.actionId && head.input === next.input && head.output === output
      ? entries.slice(1)
      : entries;
  return [next, ...rest].slice(0, limit);
}

/** One-line preview for menus: first line, collapsed whitespace, ellipsised. */
export function previewText(text: string, max = 40): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
}

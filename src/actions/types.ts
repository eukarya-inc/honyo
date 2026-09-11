// The "action" abstraction: something Honyo does to whatever the user copied.
// Translation is the first built-in action; OCR, TTS, proofreading etc. plug
// into the same shape without touching the trigger/popup/history plumbing.
// This file is electron-free so actions can be unit tested.

export type ActionInput =
  | { kind: 'text'; text: string }
  /** PNG bytes of a copied image (for OCR-style actions). */
  | { kind: 'image'; png: Uint8Array };

export type ActionInputKind = ActionInput['kind'];

/** Extra information an action can report alongside its text result. */
export interface ActionMeta {
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface ActionResult {
  text: string;
  meta?: ActionMeta;
}

export interface ActionContext {
  signal: AbortSignal;
  /** Called with the full text so far as it streams (optional for actions). */
  onChunk?: (textSoFar: string) => void;
  /** Called as soon as meta such as the language pair is known. */
  onMeta?: (meta: ActionMeta) => void;
  /** Whether the caller can display incremental output. */
  streaming: boolean;
}

export interface Action {
  id: string;
  name: string;
  /** Input kinds this action accepts, in order of preference. */
  accepts: ActionInputKind[];
  run(input: ActionInput, ctx: ActionContext): Promise<ActionResult>;
}

import type { Action, ActionInputKind } from './types.ts';

const actions = new Map<string, Action>();

export function registerAction(action: Action): void {
  actions.set(action.id, action);
}

export function getAction(id: string): Action | undefined {
  return actions.get(id);
}

export function listActions(): Action[] {
  return [...actions.values()];
}

/** Actions that can take the given input kind. */
export function actionsFor(kind: ActionInputKind): Action[] {
  return listActions().filter(a => a.accepts.includes(kind));
}

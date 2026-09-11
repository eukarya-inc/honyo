// Settings window renderer. Bundled by esbuild into build/renderer/settings.js
// and loaded as a classic script BEFORE xel.js so the theme meta is in place.
//
// The form is declarative: every editable widget carries a `data-field`
// attribute naming a SettingsSnapshot key, and the widget's tag decides how
// its value is read and written. Adding a setting means adding the key to
// SettingsSnapshot, one element to settings.html, and the mapping in the main
// process — nothing here needs to change.
import { applyNativeTheme } from '../theme.ts';
import type {
  ModelOption,
  ProfileSummary,
  SettingsPatch,
  SettingsSnapshot,
} from '../../ipc/settings.ts';

type FieldKey = keyof SettingsPatch;
type FieldValue = SettingsSnapshot[FieldKey];

// Minimal typings for the Xel widgets we bind to.
interface XValueElement extends HTMLElement {
  value: string | number | null;
}
interface XToggleElement extends HTMLElement {
  toggled: boolean;
}
interface XNotificationElement extends HTMLElement {
  opened: boolean;
}
interface XButtonElement extends HTMLElement {
  disabled: boolean;
}

applyNativeTheme(window.honyo.platform);

function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

function fieldElements(): Map<FieldKey, HTMLElement> {
  const map = new Map<FieldKey, HTMLElement>();
  for (const el of document.querySelectorAll<HTMLElement>('[data-field]')) {
    map.set(el.dataset.field as FieldKey, el);
  }
  return map;
}

function readField(el: HTMLElement): FieldValue {
  switch (el.tagName.toLowerCase()) {
    case 'x-switch':
    case 'x-checkbox':
      return (el as XToggleElement).toggled;
    case 'x-numberinput': {
      const v = (el as XValueElement).value;
      return typeof v === 'number' ? v : Number(v ?? 0);
    }
    default: {
      const v = (el as XValueElement).value;
      return v === null || v === undefined ? '' : String(v);
    }
  }
}

function writeField(el: HTMLElement, value: FieldValue): void {
  switch (el.tagName.toLowerCase()) {
    case 'x-switch':
    case 'x-checkbox':
      (el as XToggleElement).toggled = Boolean(value);
      break;
    case 'x-numberinput':
      (el as XValueElement).value = Number(value);
      break;
    default:
      (el as XValueElement).value = String(value ?? '');
  }
}

let loaded: SettingsSnapshot | null = null;
const fields = new Map<FieldKey, HTMLElement>();

function collectPatch(): SettingsPatch {
  const patch: SettingsPatch = {};
  if (!loaded) return patch;
  for (const [key, el] of fields) {
    const value = readField(el);
    if (value !== loaded[key]) {
      (patch as Record<string, FieldValue>)[key] = value;
    }
  }
  return patch;
}

function hasUnsavedChanges(): boolean {
  return Object.keys(collectPatch()).length > 0;
}

function notify(message: string, isError = false): void {
  const note = $<XNotificationElement>('#status');
  note.textContent = message;
  note.classList.toggle('error', isError);
  note.opened = false;
  note.opened = true;
}

// --- Select options ------------------------------------------------------------

function menuItem(value: string, label: string): HTMLElement {
  const item = document.createElement('x-menuitem');
  item.setAttribute('value', value);
  const text = document.createElement('x-label');
  text.textContent = label;
  item.append(text);
  return item;
}

function fillLanguageMenu(menu: HTMLElement, options: string[]): void {
  menu.replaceChildren(...options.map(l => menuItem(l, l)));
}

// Models: Default, then recommended models grouped by provider, then the
// advanced tier, then Custom — separated by rules, mirroring the tray menu.
function fillModelMenu(menu: HTMLElement, options: ModelOption[]): void {
  const nodes: HTMLElement[] = [];
  let lastGroup: ModelOption['group'] | null = null;
  for (const option of options) {
    if (lastGroup !== null && option.group !== lastGroup) nodes.push(document.createElement('hr'));
    nodes.push(menuItem(option.id, option.name));
    lastGroup = option.group;
  }
  menu.replaceChildren(...nodes);
}

function renderOptionMenus(snapshot: SettingsSnapshot): void {
  fillLanguageMenu($('#target-language-menu'), snapshot.languageOptions);
  fillLanguageMenu($('#secondary-language-menu'), snapshot.languageOptions);
  fillModelMenu($('#ai-model-menu'), snapshot.modelOptions);
}

// --- Profiles ------------------------------------------------------------------

// Management actions live at the bottom of the profile popup, macOS-style.
// Their values carry an "action:" prefix so the change handler can tell them
// apart from real profile ids.
const PROFILE_ACTIONS: Array<{ id: string; label: string }> = [
  { id: 'action:new', label: 'New Profile…' },
  { id: 'action:duplicate', label: 'Duplicate…' },
  { id: 'action:rename', label: 'Rename…' },
  { id: 'action:delete', label: 'Delete' },
];

function renderProfileMenu(profiles: ProfileSummary[], activeId: string): void {
  const menu = $('#profile-menu');
  const items = profiles.map(p => {
    const item = menuItem(p.id, p.name);
    if (p.id === activeId) item.setAttribute('toggled', '');
    return item;
  });
  const actions = PROFILE_ACTIONS.map(a => {
    const item = menuItem(a.id, a.label);
    if (a.id === 'action:delete' && profiles.length <= 1) item.setAttribute('disabled', '');
    return item;
  });
  menu.replaceChildren(...items, document.createElement('hr'), ...actions);
  $<XValueElement>('#profile-select').value = activeId;
}

type ProfileDialogMode = 'create' | 'duplicate' | 'rename';

function openProfileDialog(mode: ProfileDialogMode): void {
  if (!loaded) return;
  const dialog = $<HTMLDialogElement>('#profile-dialog');
  const input = $<XValueElement>('#profile-name-input');
  const active = loaded.profiles.find(p => p.id === loaded?.activeProfileId);
  const titles: Record<ProfileDialogMode, string> = {
    create: 'New profile',
    duplicate: 'Duplicate profile',
    rename: 'Rename profile',
  };
  $('#profile-dialog-title').textContent = titles[mode];
  input.value =
    mode === 'rename'
      ? (active?.name ?? '')
      : mode === 'duplicate'
        ? `${active?.name ?? ''} copy`
        : '';
  dialog.dataset.mode = mode;
  dialog.showModal();
}

async function submitProfileDialog(): Promise<void> {
  if (!loaded) return;
  const dialog = $<HTMLDialogElement>('#profile-dialog');
  const mode = dialog.dataset.mode as ProfileDialogMode;
  const name = String($<XValueElement>('#profile-name-input').value ?? '').trim();
  if (!name) {
    notify('Please enter a profile name.', true);
    return;
  }
  if (mode === 'rename') {
    await window.honyo.renameProfile(loaded.activeProfileId, name);
  } else {
    await window.honyo.createProfile({
      name,
      ...(mode === 'duplicate' ? { duplicateFrom: loaded.activeProfileId } : {}),
    });
  }
  dialog.close();
  await loadIntoForm();
  notify(mode === 'rename' ? 'Profile renamed' : `Profile "${name}" is now active`);
}

async function switchProfile(id: string): Promise<void> {
  if (!loaded || id === loaded.activeProfileId) return;
  if (hasUnsavedChanges()) {
    // Keep it simple: save pending edits to the old profile before switching.
    await window.honyo.save(collectPatch());
  }
  await window.honyo.selectProfile(id);
  await loadIntoForm();
  notify(`Switched to "${loaded?.profiles.find(p => p.id === id)?.name ?? ''}"`);
}

function openDeleteDialog(): void {
  if (!loaded) return;
  const active = loaded.profiles.find(p => p.id === loaded?.activeProfileId);
  $('#profile-delete-name').textContent = active?.name ?? '';
  $<HTMLDialogElement>('#profile-delete-dialog').showModal();
}

function setupProfiles(): void {
  const select = $<XValueElement>('#profile-select');
  select.addEventListener('change', () => {
    const value = String(select.value ?? '');
    if (!value.startsWith('action:')) {
      void switchProfile(value);
      return;
    }
    // Restore the popup's displayed value, then run the action.
    select.value = loaded?.activeProfileId ?? null;
    if (value === 'action:new') openProfileDialog('create');
    else if (value === 'action:duplicate') openProfileDialog('duplicate');
    else if (value === 'action:rename') openProfileDialog('rename');
    else if (value === 'action:delete') openDeleteDialog();
  });

  $('#profile-dialog-cancel').addEventListener('click', () =>
    $<HTMLDialogElement>('#profile-dialog').close(),
  );
  $('#profile-dialog-ok').addEventListener('click', () => void submitProfileDialog());
  $('#profile-name-input').addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') void submitProfileDialog();
  });

  $('#profile-delete-cancel').addEventListener('click', () =>
    $<HTMLDialogElement>('#profile-delete-dialog').close(),
  );
  $('#profile-delete-ok').addEventListener('click', () => {
    void (async (): Promise<void> => {
      if (!loaded) return;
      const ok = await window.honyo.deleteProfile(loaded.activeProfileId);
      $<HTMLDialogElement>('#profile-delete-dialog').close();
      await loadIntoForm();
      notify(ok ? 'Profile deleted' : 'The last profile cannot be deleted', !ok);
    })();
  });

  // The tray menu can switch profiles while this window is open.
  window.honyo.onProfilesChanged(() => void loadIntoForm());
}

// --- Form ----------------------------------------------------------------------

async function loadIntoForm(): Promise<void> {
  loaded = await window.honyo.load();
  // Menus must exist before a select's value can be applied.
  renderOptionMenus(loaded);
  for (const [key, el] of fields) {
    writeField(el, loaded[key]);
  }
  renderProfileMenu(loaded.profiles, loaded.activeProfileId);
}

async function saveAll(): Promise<void> {
  const button = $<XButtonElement>('#save-button');
  const patch = collectPatch();
  if (Object.keys(patch).length === 0) {
    notify('No changes to save');
    return;
  }
  button.disabled = true;
  try {
    await window.honyo.save(patch);
    await loadIntoForm();
    notify('Settings saved');
  } catch (error) {
    notify(`Failed to save: ${error instanceof Error ? error.message : String(error)}`, true);
  } finally {
    button.disabled = false;
  }
}

function setupTabs(): void {
  const tabs = $<XValueElement>('#tabs');
  const panels = document.querySelectorAll<HTMLElement>('[data-panel]');
  const show = (): void => {
    for (const panel of panels) panel.hidden = panel.dataset.panel !== tabs.value;
  };
  tabs.addEventListener('change', show);
  show();
}

function setupExternalLinks(): void {
  document.addEventListener('click', event => {
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="http"]');
    if (!anchor) return;
    event.preventDefault();
    void window.honyo.openExternal(anchor.href);
  });
}

function setupGenerateDialog(): void {
  const dialog = $<HTMLDialogElement>('#generate-dialog');
  const instruction = $<XValueElement>('#generate-instruction');
  const generateButton = $<XButtonElement>('#generate-button');
  const openButton = $<XButtonElement>('#open-generate-button');
  const promptField = fields.get('customPrompt') as XValueElement;

  openButton.addEventListener('click', () => {
    instruction.value = '';
    dialog.showModal();
  });
  $('#generate-cancel-button').addEventListener('click', () => dialog.close());

  generateButton.addEventListener('click', () => {
    void (async (): Promise<void> => {
      const text = String(instruction.value ?? '').trim();
      if (!text) {
        notify('Please describe how to change the prompt.', true);
        return;
      }
      generateButton.disabled = true;
      openButton.disabled = true;
      try {
        const result = await window.honyo.generatePrompt({
          currentPrompt: String(promptField.value ?? '').trim(),
          instruction: text,
        });
        if (result.success) {
          promptField.value = result.prompt;
          dialog.close();
          notify('Custom prompt generated. Click Save to apply.');
        } else {
          notify(`Failed to generate prompt: ${result.error}`, true);
        }
      } finally {
        generateButton.disabled = false;
        openButton.disabled = false;
      }
    })();
  });
}

function setupImmediateSaves(): void {
  // Launch-at-login talks to the OS, so apply it as soon as it is toggled.
  const el = fields.get('openAtLogin');
  el?.addEventListener('toggle', () => {
    void window.honyo
      .save({ openAtLogin: readField(el) as boolean })
      .then(() => loadIntoForm())
      .then(() => notify('Launch at login updated'));
  });

  $('#reset-popup-size-button').addEventListener('click', () => {
    void window.honyo.resetPopupSize().then(() => notify('Popup size reset to default'));
  });
}

window.addEventListener('DOMContentLoaded', () => {
  for (const [key, el] of fieldElements()) fields.set(key, el);
  setupTabs();
  setupExternalLinks();
  setupGenerateDialog();
  setupImmediateSaves();
  setupProfiles();
  $('#save-button').addEventListener('click', () => void saveAll());
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      void saveAll();
    }
  });
  void loadIntoForm();
});

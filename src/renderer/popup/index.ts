// Popup window renderer. Bundled by esbuild into build/renderer/popup.js.
// Behaviour is a direct port of the former inline script in popup.html; the
// only change is that main-process access goes through window.honyoPopup.
import type { TranslationLangs } from '../../ipc/popup.ts';

type View = 'translation' | 'back';
interface Langs {
  source: string;
  target: string;
}

let currentTranslation = '';
// Back-translation is a view toggle over the same #translation-text element.
let backTranslation: string | null = null; // cached back-translation for the current text
let view: View = 'translation';
let isBackLoading = false;
let isStreaming = false;
// Detected language pairs for each view, when known.
let currentLangs: Langs | null = null; // for the translation view
let backLangs: Langs | null = null; // for the back-translation view

function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

const translationText = (): HTMLElement => $('#translation-text');
const backButton = (): HTMLButtonElement => $<HTMLButtonElement>('#back-btn');
const copyButton = (): HTMLButtonElement => $<HTMLButtonElement>('.copy-btn');
const spinner = (): HTMLElement => $('#spinner-container');
const caption = (): HTMLElement => $('#back-caption');

function formatLangs(l: Langs): string {
  return `${l.source} → ${l.target}`;
}

function reversedLangs(l: Langs): Langs {
  return { source: l.target, target: l.source };
}

function toLangs(data: Partial<TranslationLangs> | null | undefined): Langs | null {
  return data?.sourceLanguage && data.targetLanguage
    ? { source: data.sourceLanguage, target: data.targetLanguage }
    : null;
}

// The header title doubles as the language-direction indicator for the
// current view; falls back to the app name when no pair is known.
function updateHeaderTitle(): void {
  let text = 'Honyo Translator';
  if (view === 'back') {
    if (backLangs) text = formatLangs(backLangs);
    else if (currentLangs) text = formatLangs(reversedLangs(currentLangs));
  } else if (currentLangs) {
    text = formatLangs(currentLangs);
  }
  $('#header-title-text').textContent = text;
}

function hideCaption(): void {
  const el = caption();
  el.classList.remove('error');
  el.textContent = '';
  el.style.display = 'none';
}

function applyFontSize(size: number): void {
  translationText().style.fontSize = `${size}px`;
}

// The back button is icon-only; convey its meaning via title + aria-label.
function setBackButtonLabel(btn: HTMLButtonElement, label: string): void {
  btn.title = label;
  btn.setAttribute('aria-label', label);
}

// Enable the toggle only when there is a finished translation and nothing
// is in flight.
function updateBackButtonState(): void {
  backButton().disabled = !currentTranslation || isStreaming || isBackLoading;
}

// Render the current view (translation vs back-translation) into the main
// text area, update the header language indicator + toggle button, and
// clear any leftover error caption. Does not touch the disabled state
// (see updateBackButtonState).
function renderView(): void {
  const textEl = translationText();
  const btn = backButton();
  if (view === 'back') {
    textEl.textContent = backTranslation ?? '';
    setBackButtonLabel(btn, 'Show translation');
    btn.classList.add('active');
  } else {
    textEl.textContent = currentTranslation;
    setBackButtonLabel(btn, 'Back-translate');
    btn.classList.remove('active');
  }
  hideCaption();
  updateHeaderTitle();
}

// Drop any cached back-translation and return to the translation view.
// Called whenever a new translation arrives.
function resetBackState(): void {
  backTranslation = null;
  backLangs = null;
  isBackLoading = false;
  view = 'translation';
  hideCaption();
  const btn = backButton();
  btn.classList.remove('active', 'loading');
  setBackButtonLabel(btn, 'Back-translate');
  updateHeaderTitle();
}

function showContent(): void {
  spinner().classList.remove('active');
  translationText().style.display = 'block';
}

// Back-translate button: toggles between the translation and its
// back-translation. Requests the back-translation once, then caches it.
function backTranslate(): void {
  if (!currentTranslation || isStreaming || isBackLoading) return;

  if (view === 'back') {
    // Toggle back to the translation instantly.
    view = 'translation';
    renderView();
    return;
  }

  if (backTranslation !== null) {
    // Show the cached back-translation instantly.
    view = 'back';
    renderView();
    return;
  }

  // No cache yet: request it, keeping the translation visible meanwhile.
  // The button's pulse + disabled state signals loading (no caption).
  isBackLoading = true;
  hideCaption();
  const btn = backButton();
  btn.classList.add('loading');
  btn.disabled = true;
  window.honyoPopup.backTranslate(currentTranslation);
}

function copyTranslation(): void {
  if (currentTranslation) window.honyoPopup.copyTranslation(currentTranslation);
}

function closePopup(): void {
  window.honyoPopup.closePopup();
}

// --- Main-process events -----------------------------------------------------

const popup = window.honyoPopup;

popup.on('popup-config', cfg => {
  applyFontSize(typeof cfg?.fontSize === 'number' ? cfg.fontSize : 14);
});

popup.on('translation-loading', () => {
  currentTranslation = '';
  currentLangs = null;
  spinner().classList.add('active');
  translationText().style.display = 'none';
  copyButton().disabled = true;
  resetBackState();
  updateBackButtonState();
});

// Language direction for the current translation (may arrive mid-stream).
popup.on('translation-langs', data => {
  currentLangs = toLangs(data);
  updateHeaderTitle();
});

popup.on('translation-data', data => {
  currentTranslation = data.translation;
  showContent();
  resetBackState();
  renderView();
  copyButton().disabled = false;
  updateBackButtonState();
});

// Streaming chunks: keep buttons disabled until streaming completes.
popup.on('translation-chunk', text => {
  isStreaming = true;
  currentTranslation = text;
  showContent();
  resetBackState();
  renderView();
  copyButton().disabled = true;
  updateBackButtonState();
});

popup.on('translation-complete', text => {
  isStreaming = false;
  currentTranslation = text;
  if (view === 'translation') translationText().textContent = text;
  copyButton().disabled = false;
  updateBackButtonState();
});

popup.on('back-translation-result', result => {
  // Ignore stale responses: a new translation resets isBackLoading, so a
  // result arriving afterwards belongs to the previous text.
  if (!isBackLoading) return;
  isBackLoading = false;
  backButton().classList.remove('loading');
  backTranslation = result.translation;
  backLangs = toLangs(result);
  view = 'back';
  renderView();
  updateBackButtonState();
});

popup.on('back-translation-error', message => {
  // Ignore stale responses (same reason as back-translation-result).
  if (!isBackLoading) return;
  // Stay on the translation view and cache nothing so the next click retries.
  isBackLoading = false;
  backButton().classList.remove('loading');
  view = 'translation';
  renderView();
  const el = caption();
  el.classList.add('error');
  el.textContent = message || 'Back translation failed';
  el.style.display = 'block';
  updateBackButtonState();
});

popup.on('copy-all-requested', () => copyTranslation());

// --- DOM wiring --------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  backButton().addEventListener('click', backTranslate);
  copyButton().addEventListener('click', copyTranslation);
  $('.close-btn').addEventListener('click', closePopup);

  translationText().addEventListener('contextmenu', e => {
    e.preventDefault();
    const selectedText = window.getSelection()?.toString() ?? '';
    window.honyoPopup.showContextMenu({ selectedText, hasSelection: !!selectedText });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePopup();
    } else if (e.key === 'Enter') {
      // Only allow copy when not streaming
      if (!isStreaming && currentTranslation) copyTranslation();
    }
  });
});

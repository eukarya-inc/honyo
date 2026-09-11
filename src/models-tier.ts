import type { AIModelInfo } from './models.ts';

/**
 * Model tiers for the tray menu.
 *
 * - `recommended`: fast, inexpensive models that are more than adequate for
 *   translation. Shown directly in the menu.
 * - `advanced`: frontier / reasoning / "pro" models that are overkill for a
 *   short translation request (slower, costlier, no quality gain that matters
 *   here). Folded into a collapsed submenu so they stay reachable but do not
 *   clutter the default list.
 *
 * Classification is purely name-based because the free model catalogs we
 * fetch from do not expose a reliable tier field. The heuristic is layered so
 * newly-released models classify sensibly without a code change:
 *
 * 1. Light-tier markers in the id or display name win outright
 *    (haiku, sonnet, mini, nano, flash, lite). A "Pro Mini" is still mini.
 * 2. Heavy-tier markers mark the model advanced
 *    (opus, fable, mythos, pro, ultra, reasoning, thinking, deep, research,
 *    codex, preview).
 * 3. Provider flagship families with no tier word are advanced: OpenAI
 *    GPT-5+ base models (e.g. gpt-5.6-sol) and the o-series (o1, o3, ...).
 * 4. Anything else is treated as recommended, so an unknown new model is
 *    shown rather than hidden.
 */
export type ModelTier = 'recommended' | 'advanced';

const LIGHT_MARKERS = ['haiku', 'sonnet', 'mini', 'nano', 'flash', 'lite'];
const HEAVY_MARKERS = [
  'opus',
  'fable',
  'mythos',
  'pro',
  'ultra',
  'reasoning',
  'thinking',
  'deep',
  'research',
  'codex',
  'preview',
];

// Split an id/name into lowercase word tokens so "gpt-5.6-sol" does not
// accidentally match "pro" via "preview"-style substrings, and "Flash-Lite"
// yields both "flash" and "lite".
function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// OpenAI GPT-5 and later base models ("gpt-5", "gpt-5.6-sol") carry no tier
// word but are the frontier tier; GPT-4-era models are fine for translation.
const OPENAI_FLAGSHIP_GPT = /^gpt-(\d+)(?:\.\d+)?(?:$|-)/;
// OpenAI o-series reasoning models: o1, o3, o4 (a "-mini" variant is caught by
// the light markers first).
const OPENAI_O_SERIES = /^o\d+(?:$|-)/;

export function classifyModelTier(info: AIModelInfo): ModelTier {
  const id = info.model.toLowerCase();
  const words = new Set([...tokens(info.model), ...tokens(info.name)]);

  if (LIGHT_MARKERS.some(w => words.has(w))) return 'recommended';
  if (HEAVY_MARKERS.some(w => words.has(w))) return 'advanced';

  if (info.provider === 'openai') {
    const gpt = OPENAI_FLAGSHIP_GPT.exec(id);
    if (gpt && Number(gpt[1]) >= 5) return 'advanced';
    if (OPENAI_O_SERIES.test(id)) return 'advanced';
  }

  return 'recommended';
}

/**
 * Pick the app default from a registry of available models (config key ->
 * info). The default follows the fetched catalog so it tracks new releases:
 * among Anthropic recommended-tier models (which arrive newest-first), prefer
 * a Haiku, otherwise the newest recommended one. Falls back to `fallback`
 * (the static DEFAULT_AI_MODEL) when the registry has no candidate.
 */
export function pickDefaultModelKey(models: Record<string, AIModelInfo>, fallback: string): string {
  const candidates = Object.entries(models).filter(
    ([, info]) => info.provider === 'anthropic' && classifyModelTier(info) === 'recommended',
  );
  const haiku = candidates.find(([, info]) => tokens(info.model).includes('haiku'));
  return haiku?.[0] ?? candidates[0]?.[0] ?? fallback;
}

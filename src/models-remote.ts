import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
  AI_MODELS,
  CUSTOM_MODEL_ID,
  DEFAULT_AI_MODEL,
  DEFAULT_MODEL_KEY,
  resolveModelKey,
  type AIModelInfo,
} from './models.ts';
import { limitModels } from './models-filter.ts';
import { pickDefaultModelKey } from './models-tier.ts';

type Provider = 'anthropic' | 'openai' | 'google' | 'xai';

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'google', 'xai'];

// OpenRouter uses "x-ai" as the xAI slug prefix.
const OPENROUTER_PREFIX: Record<string, Provider> = {
  anthropic: 'anthropic',
  openai: 'openai',
  google: 'google',
  'x-ai': 'xai',
};

interface ModelsCache {
  fetchedAt: number;
  source: string;
  models: Partial<Record<Provider, AIModelInfo[]>>;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cache: ModelsCache | null = null;
let cacheLoaded = false;
let refreshInFlight = false;
let onModelsChanged: (() => void) | null = null;
let getSelectedModelKey: (() => string | undefined) | null = null;

function cachePath(): string {
  return join(app.getPath('userData'), 'models-cache.json');
}

export function setModelsChangedCallback(callback: () => void): void {
  onModelsChanged = callback;
}

/**
 * Register a callback returning the currently-selected model key (config.aiModel).
 * Used to pin that model so the top-N cap never drops it out of the list. This
 * module must not import config/index.ts (circular), hence the callback.
 */
export function setSelectedModelProvider(fn: () => string | undefined): void {
  getSelectedModelKey = fn;
}

export function loadModelsCache(): void {
  try {
    const p = cachePath();
    if (existsSync(p)) {
      cache = JSON.parse(readFileSync(p, 'utf8')) as ModelsCache;
    }
  } catch (error) {
    console.error('Failed to load models cache:', error);
    cache = null;
  }
  cacheLoaded = true;
}

function saveModelsCache(): void {
  if (!cache) return;
  try {
    writeFileSync(cachePath(), JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Failed to save models cache:', error);
  }
}

// --- Filtering -----------------------------------------------------------

// Substrings that identify non-chat models (embeddings, media, etc.). Text
// embedding models still report a "text" output modality, so id-based
// filtering is required in addition to the modality check below.
const EXCLUDE_ID = [
  'embedding',
  'image',
  'dall-e',
  'tts',
  'whisper',
  'transcribe',
  'moderation',
  'realtime',
  'audio',
  'video',
  'omni',
  'imagine',
];

function isTextChatModel(id: string, outputs: string[]): boolean {
  const lid = id.toLowerCase();
  if (EXCLUDE_ID.some(e => lid.includes(e))) return false;
  if (!outputs.includes('text')) return false;
  // Exclude media-generation models (image/audio/video output).
  if (outputs.some(o => o === 'image' || o === 'audio' || o === 'video')) return false;
  return true;
}

// --- Sources -------------------------------------------------------------

interface FetchResult {
  source: string;
  models: Partial<Record<Provider, AIModelInfo[]>>;
}

interface ModelsDevModel {
  id: string;
  name?: string;
  release_date?: string;
  modalities?: { input?: string[]; output?: string[] };
}

// Primary, no-auth source: models.dev. Keyed by provider; ids match the
// official provider API model ids (e.g. claude-opus-4-8, gpt-5.6-sol,
// gemini-3.6-flash), so no id normalization is needed.
async function fetchFromModelsDev(): Promise<FetchResult> {
  const res = await fetch('https://models.dev/api.json');
  if (!res.ok) throw new Error(`models.dev request failed: ${res.status}`);
  const json = (await res.json()) as Record<string, { models?: Record<string, ModelsDevModel> }>;

  const result: Partial<Record<Provider, AIModelInfo[]>> = {};
  for (const provider of PROVIDERS) {
    const entry = json[provider];
    if (!entry?.models) continue;

    const list: Array<{ info: AIModelInfo; sort: number }> = [];
    for (const m of Object.values(entry.models)) {
      if (!m?.id) continue;
      const outputs = m.modalities?.output ?? ['text'];
      if (!isTextChatModel(m.id, outputs)) continue;
      const sort = m.release_date ? Date.parse(m.release_date) || 0 : 0;
      list.push({ info: { provider, name: m.name || m.id, model: m.id }, sort });
    }
    list.sort((a, b) => b.sort - a.sort); // newest release first
    const infos = limitModels(list.map(x => x.info));
    if (infos.length > 0) result[provider] = infos;
  }

  if (Object.keys(result).length === 0) {
    throw new Error('models.dev returned no usable models');
  }
  return { source: 'models.dev', models: result };
}

interface OpenRouterModel {
  id: string;
  name?: string;
  created?: number;
  architecture?: { output_modalities?: string[] };
}

// Secondary, no-auth source: OpenRouter. Ids look like "anthropic/claude-sonnet-5".
// CAUTION: OpenRouter slugs sometimes differ from official API ids — Anthropic
// uses dots where the official API uses dashes (claude-opus-4.8 vs
// claude-opus-4-8), and there are OpenRouter-only "-fast" variants. We strip the
// provider prefix and ":free"/":beta" tags, normalize dots to dashes for
// Anthropic, and skip Anthropic "-fast" variants that have no official id.
async function fetchFromOpenRouter(): Promise<FetchResult> {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error(`OpenRouter request failed: ${res.status}`);
  const json = (await res.json()) as { data?: OpenRouterModel[] };
  const data = json.data ?? [];

  const buckets: Record<Provider, Array<{ info: AIModelInfo; sort: number }>> = {
    anthropic: [],
    openai: [],
    google: [],
    xai: [],
  };
  const seen: Record<Provider, Set<string>> = {
    anthropic: new Set(),
    openai: new Set(),
    google: new Set(),
    xai: new Set(),
  };

  for (const it of data) {
    if (!it?.id) continue;
    const slash = it.id.indexOf('/');
    if (slash < 0) continue;
    const prov = OPENROUTER_PREFIX[it.id.slice(0, slash)];
    if (!prov) continue;

    let id = it.id.slice(slash + 1);
    const colon = id.indexOf(':');
    if (colon >= 0) id = id.slice(0, colon); // strip ":free"/":beta" tags

    const outputs = it.architecture?.output_modalities ?? ['text'];
    if (!isTextChatModel(id, outputs)) continue;

    if (prov === 'anthropic') {
      if (id.endsWith('-fast')) continue; // OpenRouter-only, no official API id
      id = id.replace(/\./g, '-'); // claude-opus-4.8 -> claude-opus-4-8
    }

    if (seen[prov].has(id)) continue;
    seen[prov].add(id);

    // Strip the "Provider: " prefix OpenRouter adds to display names.
    const name = it.name ? (it.name.split(': ').pop() ?? it.name) : id;
    buckets[prov].push({ info: { provider: prov, name, model: id }, sort: it.created ?? 0 });
  }

  const result: Partial<Record<Provider, AIModelInfo[]>> = {};
  for (const provider of PROVIDERS) {
    buckets[provider].sort((a, b) => b.sort - a.sort); // newest first
    const infos = limitModels(buckets[provider].map(x => x.info));
    if (infos.length > 0) result[provider] = infos;
  }

  if (Object.keys(result).length === 0) {
    throw new Error('OpenRouter returned no usable models');
  }
  return { source: 'openrouter', models: result };
}

// --- Registry ------------------------------------------------------------

// Merge a given cache with the static registry, keyed by config key. Fetched
// entries reuse a static entry's friendly key + name when their model id matches;
// otherwise they are keyed by model id. Providers with no fetched list fall back
// to their static AI_MODELS entries.
function buildAvailableModels(fromCache: ModelsCache | null): Record<string, AIModelInfo> {
  const staticByModelId = new Map<string, [string, AIModelInfo]>();
  for (const [key, info] of Object.entries(AI_MODELS)) {
    staticByModelId.set(info.model, [key, info]);
  }

  const result: Record<string, AIModelInfo> = {};

  for (const provider of PROVIDERS) {
    const fetched = fromCache?.models[provider];
    if (fetched && fetched.length > 0) {
      for (const info of fetched) {
        const staticMatch = staticByModelId.get(info.model);
        const key = staticMatch ? staticMatch[0] : info.model;
        result[key] = {
          provider,
          model: info.model,
          name: staticMatch ? staticMatch[1].name : info.name,
        };
      }
    } else {
      for (const [key, info] of Object.entries(AI_MODELS)) {
        if (info.provider === provider) result[key] = info;
      }
    }
  }

  return result;
}

/**
 * Merged model list. For each provider, prefer the fetched list (if present);
 * otherwise fall back to the static AI_MODELS entries for that provider. All
 * three providers are always included, regardless of API key presence. The
 * currently-selected model is pinned in as a safety net so a capped-out
 * selection still resolves.
 */
export function getAvailableModels(): Record<string, AIModelInfo> {
  if (!cacheLoaded) loadModelsCache();

  const result = buildAvailableModels(cache);

  // Safety net: keep the selected model resolvable even if it dropped out of the
  // fetched/capped list (refreshModels also pins it into the cache itself).
  const rawKey = getSelectedModelKey?.();
  const key = rawKey
    ? resolveModelKey(rawKey, pickDefaultModelKey(result, DEFAULT_AI_MODEL))
    : undefined;
  if (key && key !== CUSTOM_MODEL_ID && !result[key]) {
    const info = AI_MODELS[key];
    if (info) result[key] = info;
  }

  return result;
}

/**
 * The currently effective default model key: derived from the fetched catalog
 * (Anthropic recommended tier, Haiku preferred, newest first) so it tracks new
 * releases, falling back to the static DEFAULT_AI_MODEL.
 */
export function getDefaultModelKey(): string {
  if (!cacheLoaded) loadModelsCache();
  return pickDefaultModelKey(buildAvailableModels(cache), DEFAULT_AI_MODEL);
}

/**
 * Look up a model by its config key (the DEFAULT_MODEL_KEY sentinel resolves to
 * the current default), preferring the dynamic registry and falling back to the
 * static list (so a previously-selected static/default key keeps working even
 * when a fetched list is present).
 */
export function getModelInfo(modelId: string): AIModelInfo | undefined {
  const key = resolveModelKey(modelId, getDefaultModelKey());
  return getAvailableModels()[key] ?? AI_MODELS[key];
}

function serializeModels(models: Partial<Record<Provider, AIModelInfo[]>>): string {
  return PROVIDERS.map(p => `${p}:${(models[p] ?? []).map(m => m.model).join(',')}`).join('|');
}

/**
 * Ensure the currently-selected model survives the top-N cap by appending it to
 * the freshly-fetched lists when it is missing. Resolves the selection from the
 * OLD cache first (module `cache`, still the previous value at call time), then
 * static AI_MODELS. Mutates the passed-in lists.
 */
function pinSelectedModel(models: Partial<Record<Provider, AIModelInfo[]>>): void {
  const rawKey = getSelectedModelKey?.();
  if (!rawKey || rawKey === CUSTOM_MODEL_ID) return;
  // "default" needs no pinning: it re-resolves against whatever was fetched.
  if (rawKey === DEFAULT_MODEL_KEY) return;
  const key = resolveModelKey(rawKey);

  const info = buildAvailableModels(cache)[key] ?? AI_MODELS[key];
  if (!info) return;

  const list = models[info.provider];
  if (!list) {
    models[info.provider] = [info];
  } else if (!list.some(m => m.model === info.model)) {
    list.push(info);
  }
}

/**
 * Refresh the model list from the free no-auth sources (models.dev, then
 * OpenRouter), respecting the 24h cache TTL. Never throws or notifies — on total
 * failure the existing cache (or the static list) remains in effect. Returns
 * true if the list changed, in which case the registered callback fires so the
 * tray menu can rebuild.
 */
export async function refreshModels(): Promise<boolean> {
  if (!cacheLoaded) loadModelsCache();
  if (refreshInFlight) return false;
  refreshInFlight = true;

  try {
    if (
      cache &&
      Date.now() - cache.fetchedAt < CACHE_TTL_MS &&
      Object.keys(cache.models).length > 0
    ) {
      return false; // cache still fresh
    }

    let fetched: FetchResult | null = null;
    try {
      fetched = await fetchFromModelsDev();
    } catch (error) {
      console.error('models.dev fetch failed, trying OpenRouter:', error);
    }
    if (!fetched) {
      try {
        fetched = await fetchFromOpenRouter();
      } catch (error) {
        console.error('OpenRouter fetch failed, keeping static/cached models:', error);
      }
    }
    if (!fetched) return false;

    // Pin the selected model before caching so the cap never drops it.
    pinSelectedModel(fetched.models);

    const prev = cache ? serializeModels(cache.models) : '';
    const next = serializeModels(fetched.models);
    cache = { fetchedAt: Date.now(), source: fetched.source, models: fetched.models };
    saveModelsCache();

    const changed = prev !== next;
    if (changed) onModelsChanged?.();
    return changed;
  } finally {
    refreshInFlight = false;
  }
}

export interface AIModelInfo {
  name: string;
  provider: 'anthropic' | 'openai' | 'google';
  model: string;
}

export const AI_MODELS: Record<string, AIModelInfo> = {
  // Anthropic Claude models (latest first; fast, cost-efficient Haiku is the default)
  'claude-5-sonnet': {
    provider: 'anthropic',
    name: 'Claude Sonnet 5',
    model: 'claude-sonnet-5',
  },
  'claude-5-fable': {
    provider: 'anthropic',
    name: 'Claude Fable 5',
    model: 'claude-fable-5',
  },
  'claude-4.8-opus': {
    provider: 'anthropic',
    name: 'Claude Opus 4.8',
    model: 'claude-opus-4-8',
  },
  'claude-4.6-sonnet': {
    provider: 'anthropic',
    name: 'Claude Sonnet 4.6',
    model: 'claude-sonnet-4-6',
  },
  'claude-4.5-haiku': {
    provider: 'anthropic',
    name: 'Claude Haiku 4.5',
    model: 'claude-haiku-4-5',
  },
  // OpenAI GPT models (latest first)
  'gpt-5.6': {
    provider: 'openai',
    name: 'GPT-5.6 Sol',
    model: 'gpt-5.6-sol',
  },
  'gpt-5.6-terra': {
    provider: 'openai',
    name: 'GPT-5.6 Terra',
    model: 'gpt-5.6-terra',
  },
  'gpt-5.6-luna': {
    provider: 'openai',
    name: 'GPT-5.6 Luna',
    model: 'gpt-5.6-luna',
  },
  'gpt-5.2-mini': {
    provider: 'openai',
    name: 'GPT-5.2 Mini',
    model: 'gpt-5.2-mini',
  },
  'gpt-5.2-nano': {
    provider: 'openai',
    name: 'GPT-5.2 Nano',
    model: 'gpt-5.2-nano',
  },
  'gpt-4o': {
    provider: 'openai',
    name: 'GPT-4o',
    model: 'gpt-4o',
  },
  'gpt-4o-mini': {
    provider: 'openai',
    name: 'GPT-4o Mini',
    model: 'gpt-4o-mini',
  },
  // Google Gemini models (latest first)
  'gemini-3.6-flash': {
    provider: 'google',
    name: 'Gemini 3.6 Flash',
    model: 'gemini-3.6-flash',
  },
  'gemini-3.5-flash': {
    provider: 'google',
    name: 'Gemini 3.5 Flash',
    model: 'gemini-3.5-flash',
  },
  'gemini-3.5-flash-lite': {
    provider: 'google',
    name: 'Gemini 3.5 Flash-Lite',
    model: 'gemini-3.5-flash-lite',
  },
  'gemini-3.1-pro-preview': {
    provider: 'google',
    name: 'Gemini 3.1 Pro (Preview)',
    model: 'gemini-3.1-pro-preview',
  },
  'gemini-2.5-pro': {
    provider: 'google',
    name: 'Gemini 2.5 Pro',
    model: 'gemini-2.5-pro',
  },
  'gemini-2.5-flash': {
    provider: 'google',
    name: 'Gemini 2.5 Flash',
    model: 'gemini-2.5-flash',
  },
};

// Haiku is the default: translation is a short, latency-sensitive task where a
// fast small model is fully sufficient, so responses arrive noticeably sooner.
export const DEFAULT_AI_MODEL = 'claude-4.5-haiku';
export const CUSTOM_MODEL_ID = 'custom-model';

// Special config value meaning "follow whatever the app currently recommends".
// It resolves to DEFAULT_AI_MODEL at use time, so users who keep it get the new
// default automatically when it changes in a later release.
export const DEFAULT_MODEL_KEY = 'default';

/** Map the DEFAULT_MODEL_KEY sentinel to the concrete default model key. */
export function resolveModelKey(key: string): string {
  return key === DEFAULT_MODEL_KEY ? DEFAULT_AI_MODEL : key;
}

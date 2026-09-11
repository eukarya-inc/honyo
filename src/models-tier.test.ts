import { describe, it, expect } from 'vitest';
import { classifyModelTier, pickDefaultModelKey } from './models-tier.ts';
import { AI_MODELS, type AIModelInfo } from './models.ts';

function m(provider: AIModelInfo['provider'], model: string, name = model): AIModelInfo {
  return { provider, model, name };
}

describe('classifyModelTier', () => {
  it('marks light Anthropic models as recommended', () => {
    expect(classifyModelTier(m('anthropic', 'claude-haiku-4-5'))).toBe('recommended');
    expect(classifyModelTier(m('anthropic', 'claude-sonnet-5'))).toBe('recommended');
  });

  it('marks heavy Anthropic models as advanced', () => {
    expect(classifyModelTier(m('anthropic', 'claude-opus-4-8'))).toBe('advanced');
    expect(classifyModelTier(m('anthropic', 'claude-fable-5'))).toBe('advanced');
  });

  it('marks OpenAI mini/nano and GPT-4 era models as recommended', () => {
    expect(classifyModelTier(m('openai', 'gpt-5.2-mini'))).toBe('recommended');
    expect(classifyModelTier(m('openai', 'gpt-5.2-nano'))).toBe('recommended');
    expect(classifyModelTier(m('openai', 'gpt-4o'))).toBe('recommended');
    expect(classifyModelTier(m('openai', 'gpt-4.1'))).toBe('recommended');
  });

  it('marks OpenAI GPT-5+ flagship and o-series as advanced', () => {
    expect(classifyModelTier(m('openai', 'gpt-5.6-sol', 'GPT-5.6 Sol'))).toBe('advanced');
    expect(classifyModelTier(m('openai', 'gpt-5'))).toBe('advanced');
    expect(classifyModelTier(m('openai', 'o3'))).toBe('advanced');
    expect(classifyModelTier(m('openai', 'o4-mini'))).toBe('recommended');
    expect(classifyModelTier(m('openai', 'gpt-5-codex'))).toBe('advanced');
  });

  it('marks Gemini Flash variants as recommended and Pro as advanced', () => {
    expect(classifyModelTier(m('google', 'gemini-3.6-flash'))).toBe('recommended');
    expect(classifyModelTier(m('google', 'gemini-3.5-flash-lite'))).toBe('recommended');
    expect(classifyModelTier(m('google', 'gemini-2.5-pro'))).toBe('advanced');
    expect(classifyModelTier(m('google', 'gemini-3.1-pro-preview'))).toBe('advanced');
  });

  it('classifies xAI Grok variants', () => {
    expect(classifyModelTier(m('xai', 'grok-4.20-0309-non-reasoning'))).toBe('recommended');
    expect(classifyModelTier(m('xai', 'grok-4-fast'))).toBe('recommended');
    expect(classifyModelTier(m('xai', 'grok-4.6'))).toBe('recommended');
    expect(classifyModelTier(m('xai', 'grok-4.20-0309-reasoning'))).toBe('advanced');
    expect(classifyModelTier(m('xai', 'grok-build-0.1'))).toBe('advanced');
  });

  it('uses the display name as well as the id', () => {
    expect(classifyModelTier(m('openai', 'some-id', 'Something Mini'))).toBe('recommended');
    expect(classifyModelTier(m('google', 'some-id', 'Something Ultra'))).toBe('advanced');
  });

  it('lets a light marker win over a heavy one', () => {
    expect(classifyModelTier(m('google', 'gemini-pro-flash'))).toBe('recommended');
  });

  it('defaults unknown models to recommended so they are not hidden', () => {
    expect(classifyModelTier(m('google', 'gemma-4'))).toBe('recommended');
  });

  it('keeps at least one recommended model per provider in the static list', () => {
    for (const provider of ['anthropic', 'openai', 'google', 'xai'] as const) {
      const rec = Object.values(AI_MODELS).filter(
        i => i.provider === provider && classifyModelTier(i) === 'recommended',
      );
      expect(rec.length).toBeGreaterThan(0);
    }
  });
});

describe('pickDefaultModelKey', () => {
  const reg = (list: AIModelInfo[]): Record<string, AIModelInfo> =>
    Object.fromEntries(list.map(i => [i.model, i]));

  it('prefers a Haiku among Anthropic recommended models', () => {
    const r = reg([
      m('anthropic', 'claude-sonnet-5'),
      m('anthropic', 'claude-haiku-5'),
      m('anthropic', 'claude-haiku-4-5'),
      m('google', 'gemini-3.6-flash'),
    ]);
    expect(pickDefaultModelKey(r, 'x')).toBe('claude-haiku-5');
  });

  it('falls back to the newest recommended Anthropic model when no Haiku is listed', () => {
    const r = reg([m('anthropic', 'claude-opus-5'), m('anthropic', 'claude-sonnet-5')]);
    expect(pickDefaultModelKey(r, 'x')).toBe('claude-sonnet-5');
  });

  it('falls back to the given key when nothing qualifies', () => {
    const r = reg([m('anthropic', 'claude-opus-5'), m('google', 'gemini-3.6-flash')]);
    expect(pickDefaultModelKey(r, 'claude-4.5-haiku')).toBe('claude-4.5-haiku');
  });

  it('picks the static Haiku from the static registry', () => {
    expect(pickDefaultModelKey(AI_MODELS, 'x')).toBe('claude-4.5-haiku');
  });
});

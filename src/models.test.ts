import { describe, it, expect } from 'vitest';
import { AI_MODELS, DEFAULT_AI_MODEL, type AIModelInfo } from './models.ts';

describe('AI Models', () => {
  describe('AI_MODELS', () => {
    it('should contain expected models', () => {
      expect(AI_MODELS).toHaveProperty('claude-5-sonnet');
      expect(AI_MODELS).toHaveProperty('gpt-4o-mini');
      expect(AI_MODELS).toHaveProperty('gemini-3.5-flash');
    });

    it('should have correct provider for each model', () => {
      expect(AI_MODELS['claude-5-sonnet']?.provider).toBe('anthropic');
      expect(AI_MODELS['gpt-4o-mini']?.provider).toBe('openai');
      expect(AI_MODELS['gemini-3.5-flash']?.provider).toBe('google');
    });

    it('should have correct structure for all models', () => {
      Object.entries(AI_MODELS).forEach(([, model]) => {
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('model');
        expect(['anthropic', 'openai', 'google']).toContain(model.provider);
      });
    });
  });

  describe('DEFAULT_AI_MODEL', () => {
    it('should be a valid model key', () => {
      expect(AI_MODELS).toHaveProperty(DEFAULT_AI_MODEL);
    });

    it('should be the fast Haiku model', () => {
      expect(DEFAULT_AI_MODEL).toBe('claude-4.5-haiku');
    });
  });

  describe('AIModelInfo interface', () => {
    it('should match expected structure', () => {
      const model: AIModelInfo | undefined = AI_MODELS['claude-5-sonnet'];
      expect(model?.name).toBe('Claude Sonnet 5');
      expect(model?.provider).toBe('anthropic');
      expect(model?.model).toBe('claude-sonnet-5');
    });
  });
});

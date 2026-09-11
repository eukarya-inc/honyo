import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { CUSTOM_MODEL_ID } from '../models.ts';
import { getModelInfo } from '../models-remote.ts';
import type { ApiKeys, CustomModel, ProviderId, ProviderSettings } from '../config/types.ts';

type BaseUrls = Partial<Record<ProviderId, Pick<ProviderSettings, 'baseUrl'>>>;

// Optional custom endpoint (gateway/proxy) per provider.
function baseURL(baseUrls: BaseUrls | undefined, provider: ProviderId): { baseURL?: string } {
  const url = baseUrls?.[provider]?.baseUrl;
  return url ? { baseURL: url } : {};
}

export function getAIProvider(
  modelId: string,
  apiKeys: ApiKeys,
  customModel?: CustomModel,
  baseUrls?: BaseUrls,
): LanguageModel {
  if (modelId === CUSTOM_MODEL_ID) {
    if (!customModel || !customModel.model || !customModel.provider) {
      throw new Error('Custom model is not configured properly');
    }

    const apiKey = apiKeys[customModel.provider];
    if (!apiKey) {
      throw new Error(`No API key configured for ${customModel.provider}`);
    }

    const p = customModel.provider;
    switch (p) {
      case 'anthropic':
        return createAnthropic({ apiKey, ...baseURL(baseUrls, p) })(customModel.model);
      case 'openai':
        return createOpenAI({ apiKey, ...baseURL(baseUrls, p) })(customModel.model);
      case 'google':
        return createGoogleGenerativeAI({ apiKey, ...baseURL(baseUrls, p) })(customModel.model);
    }

    throw new Error('Unknown provider');
  }

  const modelInfo = getModelInfo(modelId);
  if (!modelInfo) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const apiKey = apiKeys[modelInfo.provider];
  if (!apiKey) {
    throw new Error(`No API key configured for ${modelInfo.provider}`);
  }

  const p = modelInfo.provider;
  switch (p) {
    case 'anthropic':
      return createAnthropic({ apiKey, ...baseURL(baseUrls, p) })(modelInfo.model);
    case 'openai':
      return createOpenAI({ apiKey, ...baseURL(baseUrls, p) })(modelInfo.model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey, ...baseURL(baseUrls, p) })(modelInfo.model);
  }

  throw new Error('Unknown provider');
}

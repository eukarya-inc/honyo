import { describe, expect, it } from 'vitest';
import { APICallError, RetryError } from 'ai';
import { describeError } from './errors.ts';

const apiError = (url: string, statusCode: number, responseBody: string): APICallError =>
  new APICallError({
    message: 'raw sdk message',
    url,
    requestBodyValues: {},
    statusCode,
    responseBody,
  });

describe('describeError', () => {
  it('names the provider and uses its message and status', () => {
    const e = apiError(
      'https://api.anthropic.com/v1/messages',
      401,
      '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}',
    );
    expect(describeError(e)).toBe('Anthropic: invalid x-api-key (HTTP 401)');
  });

  it('falls back to the SDK message and the host for gateways', () => {
    const e = apiError('https://gateway.example.com/v1/chat', 502, '<html>Bad Gateway</html>');
    expect(describeError(e)).toBe('gateway.example.com: raw sdk message (HTTP 502)');
  });

  it('unwraps retry errors to the last failure', () => {
    const last = apiError(
      'https://api.openai.com/v1/responses',
      429,
      '{"error":{"message":"Rate limit"}}',
    );
    const e = new RetryError({
      message: 'Failed after 3 attempts',
      reason: 'maxRetriesExceeded',
      errors: [last],
    });
    expect(describeError(e)).toBe('OpenAI: Rate limit (HTTP 429)');
  });

  it('reports network failures by their cause', () => {
    const e = new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND api.x.ai') });
    expect(describeError(e)).toBe('Network error: getaddrinfo ENOTFOUND api.x.ai');
  });

  it('passes other errors through', () => {
    expect(describeError(new Error('Japanese is not supported'))).toBe('Japanese is not supported');
    expect(describeError('boom')).toBe('boom');
  });
});

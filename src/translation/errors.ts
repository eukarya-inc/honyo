// Pure, electron-free: turn an error from an AI provider (or the local model)
// into one line the user can act on, e.g.
//   "Anthropic: invalid x-api-key (HTTP 401)"

import { APICallError, RetryError } from 'ai';

function hostLabel(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname;
    if (host.endsWith('anthropic.com')) return 'Anthropic';
    if (host.endsWith('openai.com')) return 'OpenAI';
    if (host.endsWith('googleapis.com')) return 'Google';
    if (host.endsWith('x.ai')) return 'xAI';
    return host;
  } catch {
    return undefined;
  }
}

/** The provider's own message from a JSON error body, when there is one. */
function bodyMessage(body: string | undefined): string | undefined {
  if (!body) return undefined;
  try {
    const json = JSON.parse(body) as {
      error?: { message?: unknown } | string;
      message?: unknown;
    };
    const m = typeof json.error === 'string' ? json.error : (json.error?.message ?? json.message);
    return typeof m === 'string' && m ? m : undefined;
  } catch {
    return undefined;
  }
}

export function describeError(error: unknown): string {
  // After retries the SDK wraps the last failure; report that one.
  if (RetryError.isInstance(error) && error.lastError) return describeError(error.lastError);

  if (APICallError.isInstance(error)) {
    const who = hostLabel(error.url);
    const what = bodyMessage(error.responseBody) ?? error.message;
    const status = error.statusCode ? ` (HTTP ${error.statusCode})` : '';
    return `${who ? `${who}: ` : ''}${what}${status}`;
  }

  if (error instanceof Error) {
    // fetch() network failures carry the useful part in `cause`.
    const { cause } = error;
    if (error.message === 'fetch failed' && cause instanceof Error) {
      return `Network error: ${cause.message}`;
    }
    return error.message;
  }
  return String(error);
}

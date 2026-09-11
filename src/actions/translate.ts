// Built-in action: translate text between the active profile's languages.
import { getConfig } from '../config/index.ts';
import { translateTextDetailed, translateTextStreamingStrict } from '../translation/index.ts';
import type { Action, ActionResult } from './types.ts';

export const TRANSLATE_ACTION_ID = 'translate';

export const translateAction: Action = {
  id: TRANSLATE_ACTION_ID,
  name: 'Translate',
  accepts: ['text'],
  async run(input, ctx): Promise<ActionResult> {
    if (input.kind !== 'text') throw new Error('Translate needs text input');
    const { targetLanguage, secondaryLanguage } = getConfig();

    if (ctx.streaming && ctx.onChunk) {
      const text = await translateTextStreamingStrict(
        input.text,
        targetLanguage,
        secondaryLanguage,
        ctx.onChunk,
        ctx.signal,
        (sourceLanguage, targetLang) =>
          ctx.onMeta?.({ sourceLanguage, targetLanguage: targetLang }),
      );
      return { text };
    }

    const result = await translateTextDetailed(
      input.text,
      targetLanguage,
      secondaryLanguage,
      ctx.signal,
    );
    const meta =
      result.sourceLanguage && result.targetLanguage
        ? { sourceLanguage: result.sourceLanguage, targetLanguage: result.targetLanguage }
        : undefined;
    if (meta) ctx.onMeta?.(meta);
    return meta ? { text: result.translation, meta } : { text: result.translation };
  },
};

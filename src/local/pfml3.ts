// Pure helpers for PLaMo 3 Translate: honyo language names -> PLaMo language
// codes, and the PFML3 prompt the model is fed through the Completions API.

/** honyo language name -> PLaMo 3 Translate code. */
const PLAMO_CODES: Record<string, string> = {
  English: 'en',
  Japanese: 'ja',
  'Chinese (Simplified)': 'zh-hans',
  'Chinese (Traditional)': 'zh-hant',
  Korean: 'ko',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Italian: 'it',
  Russian: 'ru',
  Arabic: 'ar',
  Hindi: 'hi',
  Thai: 'th',
  Vietnamese: 'vi',
  Indonesian: 'id',
  Malay: 'ms',
  Filipino: 'tl',
  Dutch: 'nl',
  Polish: 'pl',
  Azerbaijani: 'az',
  Belarusian: 'be',
  Bulgarian: 'bg',
  Bengali: 'bn',
  Catalan: 'ca',
  Cebuano: 'ceb',
  Estonian: 'et',
  Basque: 'eu',
  Persian: 'fa',
  Gujarati: 'gu',
  Hebrew: 'he',
  Croatian: 'hr',
  Hungarian: 'hu',
  Armenian: 'hy',
  Javanese: 'jv',
  Georgian: 'ka',
  Kazakh: 'kk',
  Khmer: 'km',
  Lithuanian: 'lt',
  Latvian: 'lv',
  Malayalam: 'ml',
  Marathi: 'mr',
  Burmese: 'my',
  Nepali: 'ne',
  Punjabi: 'pa',
  Sinhala: 'si',
  Slovak: 'sk',
  Slovenian: 'sl',
  Serbian: 'sr',
  Swahili: 'sw',
  Tamil: 'ta',
  Telugu: 'te',
  Urdu: 'ur',
  Uzbek: 'uz',
};

/** PLaMo code for a honyo language name, or undefined when PLaMo lacks it. */
export function plamoLanguageCode(language: string): string | undefined {
  return PLAMO_CODES[language];
}

const SPECIAL_TOKEN_RE = /<\|plamo:[a-z]+\|>/g;

/**
 * Build a PFML3 translation prompt. llama-server parses special tokens in the
 * prompt string, so any `<|plamo:...|>` markers in the source text are
 * stripped: otherwise a copied snippet could rewrite the prompt structure.
 */
export function buildPfml3Prompt(text: string, targetCode: string): string {
  const source = text.replace(SPECIAL_TOKEN_RE, '');
  return (
    '<|plamo:tag|>dataset<|plamo:msg|>translation' +
    `<|plamo:tag|>input<|plamo:msg|>${source}` +
    `<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>${targetCode}<|plamo:msg|>`
  );
}

/** Generation stops when the model opens the next element or a new sequence. */
export const PFML3_STOP = ['<|plamo:tag|>', '<|plamo:bos|>'];

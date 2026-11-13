// Pure helpers for PLaMo 3 Translate: honyo language names -> PLaMo language
// codes, source-language detection for honyo's primary/secondary swap, and the
// PFML3 prompt the model is fed through the Completions API.

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

// Writing systems and the honyo languages written in them. Order matters:
// kana is checked before Han so Japanese with kanji is not taken as Chinese.
const SCRIPTS: Array<[RegExp, string[]]> = [
  [/[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/, ['Japanese']],
  [/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/, ['Korean']],
  [/[\u0e00-\u0e7f]/, ['Thai']],
  [/[\u0590-\u05ff]/, ['Hebrew']],
  [/[\u0530-\u058f]/, ['Armenian']],
  [/[\u10a0-\u10ff]/, ['Georgian']],
  [/[\u0980-\u09ff]/, ['Bengali']],
  [/[\u0a00-\u0a7f]/, ['Punjabi']],
  [/[\u0a80-\u0aff]/, ['Gujarati']],
  [/[\u0b80-\u0bff]/, ['Tamil']],
  [/[\u0c00-\u0c7f]/, ['Telugu']],
  [/[\u0d00-\u0d7f]/, ['Malayalam']],
  [/[\u0d80-\u0dff]/, ['Sinhala']],
  [/[\u1780-\u17ff]/, ['Khmer']],
  [/[\u1000-\u109f]/, ['Burmese']],
  [/[\u0900-\u097f]/, ['Hindi', 'Marathi', 'Nepali']],
  [/[\u0600-\u06ff]/, ['Arabic', 'Persian', 'Urdu']],
  [/[\u0400-\u04ff]/, ['Russian', 'Ukrainian', 'Bulgarian', 'Belarusian', 'Serbian', 'Kazakh']],
  [/[\u4e00-\u9fff\u3400-\u4dbf]/, ['Chinese (Simplified)', 'Chinese (Traditional)', 'Japanese']],
];
const LATIN_SCRIPT = new Set(
  Object.keys(PLAMO_CODES).filter(l => !SCRIPTS.some(([, langs]) => langs.includes(l))),
);

/**
 * Decide which of the two configured languages the input is written in, from
 * its writing system. A dedicated translation model cannot follow honyo's
 * "detect, then swap" instructions, so the app has to pick the direction.
 *
 * Returns `primary` only when the script is evidence for it; anything else
 * (another language, ambiguous Latin text) is treated as "not primary" and is
 * translated into `primary`, matching the cloud prompt's rule 2.
 */
export function isInPrimaryLanguage(text: string, primary: string, secondary: string): boolean {
  for (const [re, langs] of SCRIPTS) {
    if (re.test(text)) {
      if (langs.includes(primary) && !langs.includes(secondary)) return true;
      if (langs.includes(secondary) && !langs.includes(primary)) return false;
      // Both or neither use this script: keep checking narrower evidence.
      if (langs.includes(primary) && langs.includes(secondary)) continue;
      return false;
    }
  }
  // No distinctive script: plain Latin text.
  return LATIN_SCRIPT.has(primary) && !LATIN_SCRIPT.has(secondary);
}

/**
 * Best-effort name of the source language for display. Unambiguous scripts
 * (kana, Hangul, Thai, ...) name it; otherwise `fallback` (the other language
 * of the pair) is returned.
 */
export function guessSourceLanguage(text: string, fallback: string): string {
  for (const [re, langs] of SCRIPTS) {
    if (re.test(text)) return langs.length === 1 ? (langs[0] ?? fallback) : fallback;
  }
  return fallback;
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

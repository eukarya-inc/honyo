// Pure, electron-free helper that turns the app-side language detection into
// a hint for the cloud translation prompt. Models tend to over-weight
// Latin-script product names, identifiers and pasted code ("Honyo", "SRE",
// "useEffect") and take a Japanese sentence such as
// "HonyoはSREチームがメンテできる" for English, or the reverse for an English
// sentence quoting a Japanese word. detectLanguage judges only the prose and
// votes by words, so its answer is passed to the model as a hint.
//
// Plain Latin text gets no hint: the model tells Latin languages apart better
// than n-grams do.

import { detectLanguage, extractProse, type Script } from '../language/detect.ts';

const GROUPS: Partial<Record<Script, string>> = {
  han: 'Chinese (it has Han characters but no kana)',
  cyrillic:
    'a Cyrillic-script language (most likely Russian, Ukrainian, Bulgarian, Serbian, Belarusian or Kazakh)',
  arabic: 'an Arabic-script language (most likely Arabic, Persian or Urdu)',
  devanagari: 'a Devanagari-script language (most likely Hindi, Marathi or Nepali)',
};

const NON_LATIN_LETTER = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

/**
 * A one-line hint about the language of the input's prose, or undefined when
 * there is nothing useful to say (plain Latin-script prose, empty input).
 */
export function detectScriptHint(text: string): string | undefined {
  const d = detectLanguage(text);
  if (!d.script || !d.language) return undefined;

  if (d.script === 'latin') {
    // Only worth saying when other scripts or code could mislead the model.
    const mixed = NON_LATIN_LETTER.test(text) || extractProse(text).trim() !== text.trim();
    if (!mixed) return undefined;
  }

  const language = GROUPS[d.script] ?? d.language;
  return `Judging by its sentence structure, the input is written in ${language}. Names, acronyms, quoted terms and code in other languages or scripts do not change that.`;
}

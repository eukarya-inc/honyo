// Pure, electron-free helper that derives a language hint from the writing
// system of the input text. Language detection is otherwise left to the model,
// but the model tends to over-weight Latin-script product names, acronyms and
// identifiers ("Honyo", "SRE", "API") and misclassify a Japanese sentence such
// as "HonyoはSREチームがメンテできる" as English. Scripts like kana or Hangul
// are unambiguous evidence of the sentence's language, so we hand that to the
// model as a hint in the system prompt.

// [script, what it says about the sentence]. Order matters: kana before Han.
const SCRIPTS: Array<[RegExp, string, string]> = [
  [/[぀-ヿㇰ-ㇿｦ-ﾟ]/, 'Japanese kana (hiragana/katakana)', 'Japanese'],
  [/[가-힯ᄀ-ᇿ㄰-㆏]/, 'Hangul', 'Korean'],
  [/[฀-๿]/, 'Thai script', 'Thai'],
  [/[֐-׿]/, 'Hebrew script', 'Hebrew'],
  [/[԰-֏]/, 'Armenian script', 'Armenian'],
  [/[Ⴀ-ჿ]/, 'Georgian script', 'Georgian'],
  [/[ঀ-৿]/, 'Bengali script', 'Bengali'],
  [/[਀-੿]/, 'Gurmukhi script', 'Punjabi'],
  [/[઀-૿]/, 'Gujarati script', 'Gujarati'],
  [/[஀-௿]/, 'Tamil script', 'Tamil'],
  [/[ఀ-౿]/, 'Telugu script', 'Telugu'],
  [/[ഀ-ൿ]/, 'Malayalam script', 'Malayalam'],
  [/[඀-෿]/, 'Sinhala script', 'Sinhala'],
  [/[ក-៿]/, 'Khmer script', 'Khmer'],
  [/[က-႟]/, 'Myanmar script', 'Burmese'],
  [
    /[ऀ-ॿ]/,
    'Devanagari script',
    'a Devanagari-script language (most likely Hindi, Marathi or Nepali)',
  ],
  [/[؀-ۿ]/, 'Arabic script', 'an Arabic-script language (most likely Arabic, Persian or Urdu)'],
  [
    /[Ѐ-ӿ]/,
    'Cyrillic script',
    'a Cyrillic-script language (most likely Russian, Ukrainian, Bulgarian, Serbian, Belarusian or Kazakh)',
  ],
];
const HAN_RE = /[一-鿿㐀-䶿]/;

/**
 * Return a short, human-readable hint about the language implied by the
 * input's writing system, or undefined when the script alone says nothing
 * useful (e.g. pure Latin text, which could be any of many languages).
 */
export function detectScriptHint(text: string): string | undefined {
  for (const [re, script, language] of SCRIPTS) {
    if (re.test(text)) {
      return `The input contains ${script}, so the sentence itself is written in ${language} even if it also contains Latin-script names, acronyms, or code.`;
    }
  }
  if (HAN_RE.test(text)) {
    return 'The input contains Han characters but no kana, so the sentence itself is most likely written in Chinese even if it also contains Latin-script names, acronyms, or code.';
  }
  return undefined;
}

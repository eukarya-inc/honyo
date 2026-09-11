// Pure, electron-free helper that derives a language hint from the writing
// system of the input text. Language detection is otherwise left to the model,
// but the model tends to over-weight Latin-script product names, acronyms and
// identifiers ("Honyo", "SRE", "API") and misclassify a Japanese sentence such
// as "HonyoはSREチームがメンテできる" as English. Scripts like kana or Hangul
// are unambiguous evidence of the sentence's language, so we hand that to the
// model as a hint in the system prompt.

const KANA_RE = /[぀-ゟ゠-ヿㇰ-ㇿｦ-ﾟ]/;
const HANGUL_RE = /[가-힯ᄀ-ᇿ㄰-㆏]/;
const HAN_RE = /[一-鿿㐀-䶿]/;
const THAI_RE = /[฀-๿]/;
const CYRILLIC_RE = /[Ѐ-ӿ]/;
const ARABIC_RE = /[؀-ۿ]/;
const DEVANAGARI_RE = /[ऀ-ॿ]/;

/**
 * Return a short, human-readable hint about the language implied by the
 * input's writing system, or undefined when the script alone says nothing
 * useful (e.g. pure Latin text, which could be any of many languages).
 */
export function detectScriptHint(text: string): string | undefined {
  if (KANA_RE.test(text)) {
    return 'The input contains Japanese kana (hiragana/katakana), so the sentence itself is written in Japanese even if it also contains Latin-script names, acronyms, or code.';
  }
  if (HANGUL_RE.test(text)) {
    return 'The input contains Hangul, so the sentence itself is written in Korean even if it also contains Latin-script names, acronyms, or code.';
  }
  if (THAI_RE.test(text)) {
    return 'The input contains Thai script, so the sentence itself is written in Thai even if it also contains Latin-script names, acronyms, or code.';
  }
  if (DEVANAGARI_RE.test(text)) {
    return 'The input contains Devanagari script, so the sentence itself is written in Hindi even if it also contains Latin-script names, acronyms, or code.';
  }
  if (ARABIC_RE.test(text)) {
    return 'The input contains Arabic script, so the sentence itself is written in Arabic even if it also contains Latin-script names, acronyms, or code.';
  }
  if (CYRILLIC_RE.test(text)) {
    return 'The input contains Cyrillic script, so the sentence itself is written in a Cyrillic-script language (most likely Russian or Ukrainian) even if it also contains Latin-script names, acronyms, or code.';
  }
  if (HAN_RE.test(text)) {
    return 'The input contains Han characters but no kana, so the sentence itself is most likely written in Chinese even if it also contains Latin-script names, acronyms, or code.';
  }
  return undefined;
}

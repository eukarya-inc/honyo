// Pure, electron-free source-language detection, tuned for what people copy at
// work: prose mixed with product names, identifiers, URLs and code.
//
//   1. Strip what is not prose (code, URLs, paths, identifiers, markup).
//   2. Split into words with Intl.Segmenter and vote by writing system. Words
//      count, not characters, so one Japanese word in an English sentence (or
//      a few English terms in a Japanese one) does not flip the result, and
//      Japanese particles count extra: they are the sentence's grammar.
//   3. Within Latin script, compare the candidate languages with ELD n-grams.

import { eld } from 'eld/small';
import { LANGUAGES } from './constants.ts';

// --- 1. Prose extraction -------------------------------------------------------

const NON_PROSE: RegExp[] = [
  /^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, // fenced code blocks
  // Pasted errors and logs: from "TypeError:" / "ENOENT:" to the end of the
  // line, or up to where Japanese/Chinese/Korean prose resumes.
  /\b(?:[A-Z]\w*(?:Error|Exception)|Error|Traceback|E[A-Z]{3,})\b:[^\n\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]*/g,
  /^\s*at \S.*$/gm, // stack frames
  /`[^`\n]+`/g, // inline code
  /<\/?[a-zA-Z][^>\n]*>/g, // HTML/XML tags
  /\]\([^)\s]*\)/g, // Markdown link targets: keep the link text
  /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, // URLs
  /\bwww\.\S+/gi,
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, // e-mail addresses
  /(?<![\w/])(?:~|\.{1,2})?[\w.@-]*(?:\/[\w.@-]+)+\/?/g, // paths: src/a.ts, ~/x, /usr/bin
  /\b[A-Za-z]:\\[^\s]*/g, // Windows paths
  /(?:^|\s)--?[a-zA-Z][\w-]*/g, // CLI flags
  /\b[\w$]+(?:\.[\w$]+)*\([^)\n]*\)/g, // calls: foo(), a.b(c)
  /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\b/g, // dotted: a.b.c, Next.js, config.json
  /\b[a-z]+[A-Z][A-Za-z0-9]*\b/g, // camelCase
  /\b[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+\b/g, // snake_case, SCREAMING_CASE
  /\b[0-9a-f]{7,}\b/gi, // hashes
];

// A line that is mostly symbols and code keywords is code even without fences.
const CODE_LINE =
  /^\s*(?:(?:import|export|const|let|var|function|def|class|return|if|for|while|public|private|package|func|fn|use|#include)\b.*|[{}()[\];]+|.*[;{]\s*)$/;

/** The prose part of `text`: code, URLs, paths and identifiers removed. */
export function extractProse(text: string): string {
  let s = text;
  for (const re of NON_PROSE) s = s.replace(re, ' ');
  return s
    .split('\n')
    .filter(line => !CODE_LINE.test(line))
    .join('\n');
}

// --- 2. Script vote --------------------------------------------------------------

export type Script =
  | 'kana'
  | 'han'
  | 'hangul'
  | 'latin'
  | 'cyrillic'
  | 'arabic'
  | 'devanagari'
  | 'other';

const SCRIPT_RES: Array<[Script, RegExp]> = [
  ['kana', /[぀-ヿㇰ-ㇿｦ-ﾟ]/],
  ['hangul', /[가-힯ᄀ-ᇿ㄰-㆏]/],
  ['han', /[一-鿿㐀-䶿]/],
  ['latin', /[A-Za-zÀ-ɏḀ-ỿ]/],
  ['cyrillic', /[Ѐ-ӿ]/],
  ['arabic', /[؀-ۿ]/],
  ['devanagari', /[ऀ-ॿ]/],
];

/** Scripts used by exactly one default language. */
const SINGLE_SCRIPT: Array<[RegExp, string]> = [
  [/[฀-๿]/, 'Thai'],
  [/[֐-׿]/, 'Hebrew'],
  [/[԰-֏]/, 'Armenian'],
  [/[Ⴀ-ჿ]/, 'Georgian'],
  [/[ঀ-৿]/, 'Bengali'],
  [/[਀-੿]/, 'Punjabi'],
  [/[઀-૿]/, 'Gujarati'],
  [/[஀-௿]/, 'Tamil'],
  [/[ఀ-౿]/, 'Telugu'],
  [/[ഀ-ൿ]/, 'Malayalam'],
  [/[඀-෿]/, 'Sinhala'],
  [/[ក-៿]/, 'Khmer'],
  [/[က-႟]/, 'Burmese'],
];

const SCRIPT_LANGUAGES: Record<Exclude<Script, 'other'>, string[]> = {
  kana: ['Japanese'],
  hangul: ['Korean'],
  han: ['Chinese (Simplified)', 'Chinese (Traditional)', 'Japanese'],
  latin: [], // filled below: everything not written in another script
  cyrillic: ['Russian', 'Ukrainian', 'Bulgarian', 'Belarusian', 'Serbian', 'Kazakh'],
  arabic: ['Arabic', 'Persian', 'Urdu'],
  devanagari: ['Hindi', 'Marathi', 'Nepali'],
};
{
  const nonLatin = new Set([
    ...Object.values(SCRIPT_LANGUAGES).flat(),
    ...SINGLE_SCRIPT.map(([, l]) => l),
  ]);
  SCRIPT_LANGUAGES.latin = Object.values(LANGUAGES).filter(l => !nonLatin.has(l));
}

// Japanese particles and copulas: grammar, not vocabulary.
const JA_PARTICLES = new Set([
  'は',
  'が',
  'を',
  'に',
  'で',
  'と',
  'の',
  'も',
  'へ',
  'や',
  'から',
  'まで',
  'より',
  'では',
  'には',
  'とは',
  'でも',
  'って',
  'です',
  'ます',
  'した',
  'する',
  'して',
]);

function scriptOf(word: string): Script {
  for (const [script, re] of SCRIPT_RES) if (re.test(word)) return script;
  return 'other';
}

const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });

interface Vote {
  votes: Map<Script, number>;
  /** Single-script language with the most characters, if any. */
  single?: string;
  latinText: string;
}

function vote(prose: string): Vote {
  const votes = new Map<Script, number>();
  const add = (script: Script, weight: number): void => {
    votes.set(script, (votes.get(script) ?? 0) + weight);
  };
  const latinWords: string[] = [];

  // Japanese has no spaces, and the segmenter splits words it doesn't know
  // into pieces (ありがとう|ご|ざ|い|ます). So an unbroken run of kana/kanji
  // counts as one word, plus one per particle in it: the particles are what
  // show the sentence itself is Japanese.
  let run: { kana: boolean; weight: number } | undefined;
  const endRun = (): void => {
    if (run) add(run.kana ? 'kana' : 'han', run.weight);
    run = undefined;
  };

  for (const { segment, isWordLike } of segmenter.segment(prose)) {
    const script = isWordLike ? scriptOf(segment) : undefined;
    if (script === 'kana' || script === 'han') {
      run ??= { kana: false, weight: 1 };
      if (script === 'kana') run.kana = true;
      if (JA_PARTICLES.has(segment)) run.weight += 1;
      continue;
    }
    endRun();
    if (!script) continue;
    if (script === 'latin') {
      latinWords.push(segment);
      // All-caps acronyms (API, SRE, PR) are vocabulary in any language.
      add(script, /^[A-Z0-9]{2,6}s?$/.test(segment) ? 0.25 : 1);
    } else {
      add(script, 1);
    }
  }
  endRun();

  // Han only says "Japanese" when kana is present too.
  if (votes.has('kana') && votes.has('han')) {
    votes.set('kana', (votes.get('kana') ?? 0) + (votes.get('han') ?? 0));
    votes.delete('han');
  }
  let single: string | undefined;
  let best = 0;
  for (const [re, lang] of SINGLE_SCRIPT) {
    const n = (prose.match(new RegExp(re.source, 'g')) ?? []).length;
    if (n > best) [best, single] = [n, lang];
  }
  if (single) votes.set('other', Math.max(votes.get('other') ?? 0, 1));
  return { votes, ...(single ? { single } : {}), latinText: latinWords.join(' ') };
}

// --- 3. Latin languages -----------------------------------------------------------

/** honyo language name -> ELD code (ELD folds Indonesian into Malay). */
const ELD_CODE: Record<string, string> = {};
for (const [code, name] of Object.entries(LANGUAGES)) ELD_CODE[name] = code.split('-')[0] ?? code;
ELD_CODE.Indonesian = 'ms';
ELD_CODE.Filipino = 'tl';

function rankLatin(text: string, candidates: string[]): string | undefined {
  if (candidates.length === 1) return candidates[0];
  const scores = eld.detect(text).getScores();
  let best: string | undefined;
  let bestScore = 0;
  for (const c of candidates) {
    const s = scores[ELD_CODE[c] ?? ''] ?? 0;
    if (s > bestScore) [best, bestScore] = [c, s];
  }
  return best;
}

// --- Public API ---------------------------------------------------------------

export interface Detection {
  /** Detected language (a honyo language name), or undefined if unknown. */
  language?: string;
  /** Writing system that won the vote ("latin", "kana", "han", ...). */
  script?: Script;
  /** How sure the vote was: share of word votes for the winning script. */
  confidence: number;
}

/**
 * Detect the language of `text`. With `candidates` (e.g. the primary and
 * secondary language), the answer is restricted to them whenever the text's
 * script allows it, which makes short and mixed inputs far more reliable.
 */
export function detectLanguage(text: string, candidates?: string[]): Detection {
  let prose = extractProse(text);
  if (!prose.trim()) prose = text; // nothing but code: judge what there is
  const { votes, single, latinText } = vote(prose);

  const total = [...votes.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return { confidence: 0 };
  const [script, count] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['other', 0];
  const confidence = count / total;

  if (script === 'other') {
    return single ? { language: single, script, confidence } : { script, confidence };
  }

  const inScript = SCRIPT_LANGUAGES[script];
  const pool = candidates?.filter(c => inScript.includes(c)) ?? [];

  if (script === 'latin') {
    const language = rankLatin(latinText || prose, pool.length ? pool : inScript);
    return language ? { language, script, confidence } : { script, confidence };
  }
  if (script === 'han') {
    // Kanji without kana: Chinese, unless only Japanese is on offer.
    const zh = pool.find(c => c.startsWith('Chinese')) ?? 'Chinese (Simplified)';
    return { language: pool.length === 1 ? (pool[0] ?? zh) : zh, script, confidence };
  }
  const language = pool[0] ?? inScript[0];
  return language ? { language, script, confidence } : { script, confidence };
}

/**
 * honyo's two-way rule for a text: in `primary` -> translate to `secondary`,
 * anything else -> translate to `primary`. Used where the model cannot apply
 * the rule itself (the local translation model takes no instructions).
 */
export function pickDirection(
  text: string,
  primary: string,
  secondary: string,
): { source: string; target: string } {
  const { language } = detectLanguage(text, [primary, secondary]);
  if (language === primary) return { source: primary, target: secondary };
  return { source: language ?? secondary, target: primary };
}

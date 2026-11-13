import { describe, expect, it } from 'vitest';
import { detectLanguage, extractProse, pickDirection } from './detect.ts';

const JA_EN = ['Japanese', 'English'];
const lang = (text: string, candidates?: string[]): string | undefined =>
  detectLanguage(text, candidates).language;

describe('extractProse', () => {
  it('drops code blocks, inline code, URLs, paths and identifiers', () => {
    const prose = extractProse(
      [
        '`npm run build` が失敗します。詳細は https://example.com/issues/1 を参照。',
        '```ts',
        'const answer = computeTotal(items);',
        '```',
        'src/local/server.ts の useEffect と MAX_OUTPUT_TOKENS を見てください。',
      ].join('\n'),
    );
    for (const gone of [
      'npm run build',
      'https',
      'computeTotal',
      'src/local',
      'useEffect',
      'MAX_OUTPUT',
    ]) {
      expect(prose).not.toContain(gone);
    }
    expect(prose).toContain('が失敗します');
    expect(prose).toContain('を見てください');
  });

  it('keeps Markdown link text but not the target', () => {
    expect(extractProse('See [the docs](https://x.dev/a) first')).not.toContain('x.dev');
    expect(extractProse('See [the docs](https://x.dev/a) first')).toContain('the docs');
  });
});

describe('detectLanguage: Japanese vs English', () => {
  it.each([
    'HonyoはSREチームがメンテできる',
    'Next.jsのApp RouterでServer Componentsを使う',
    'このPRではReactのuseEffectをリファクタしてAPIクライアントのretry処理を追加しました',
    'Slackの#generalチャンネルにpostしておいて',
    'それ、たぶんcache invalidationのissueだと思う',
    "TypeError: Cannot read properties of undefined (reading 'map') が出ます",
    "Error: ENOENT: no such file or directory, open '/tmp/a.json'\nってエラーが出るんだけど",
    'エラーです:\n    at fetchUser (src/api.ts:12:5)\n    at main (src/index.ts:3:1)',
    '- [ ] READMEを更新\n- [ ] CHANGELOGを書く\n- [x] testを追加',
    'feat: ローカル翻訳を追加',
    'LGTMです！mergeお願いします',
    'GitHub ActionsのworkflowでDocker imageをbuildしてECRにpushする',
    '会議室',
    '明日のmeetingはreschedule',
  ])('Japanese: %s', text => {
    expect(lang(text, JA_EN)).toBe('Japanese');
  });

  it.each([
    'The SRE team can maintain Honyo',
    'In Japanese, ありがとうございます means thank you',
    'The particle は marks the topic of a sentence.',
    'We had ramen at 一蘭 in Shibuya last night, it was great',
    'Please merge',
    'LGTM',
    'Can you check the 東京 office schedule?',
    "TypeError: Cannot read properties of undefined (reading 'map')",
    'The 「おもてなし」 spirit is central to Japanese hospitality.',
    'He said "よろしくお願いします" and bowed.',
    'Kaizen (改善) means continuous improvement.',
    'I love 寿司 and ラーメン',
    'ok',
  ])('English: %s', text => {
    expect(lang(text, JA_EN)).toBe('English');
  });

  it('ignores source code when judging the prose', () => {
    const text = [
      '以下の関数でエラーになります。',
      '```js',
      'function fetchUser(id) {',
      '  return fetch(`/api/users/${id}`).then(res => res.json());',
      '}',
      '```',
    ].join('\n');
    expect(lang(text, JA_EN)).toBe('Japanese');

    const en = 'This throws: `const 名前 = getName();` when the user is missing.';
    expect(lang(en, JA_EN)).toBe('English');
  });

  it('judges code-only input by what is there', () => {
    expect(detectLanguage('const x = 1;', JA_EN).language).toBe('English');
  });
});

describe('detectLanguage: other languages', () => {
  it('separates Latin-script candidates with n-grams', () => {
    expect(lang('Merci, je vais vérifier demain.', ['English', 'French'])).toBe('French');
    expect(lang('Thanks, I will check it tomorrow.', ['English', 'French'])).toBe('English');
    expect(lang('Kannst du den PR reviewen?', ['English', 'German'])).toBe('German');
    expect(lang('Gracias, lo reviso mañana.', ['Spanish', 'Japanese'])).toBe('Spanish');
  });

  it('names a third language outside the candidates', () => {
    expect(lang('안녕하세요, 만나서 반갑습니다.', JA_EN)).toBe('Korean');
    expect(lang('Merci, je vais vérifier demain.', JA_EN)).toBe('English');
    expect(lang('Merci, je vais vérifier demain.')).toBe('French');
    expect(lang('שלום עולם', JA_EN)).toBe('Hebrew');
  });

  it('picks the candidate sharing a script', () => {
    expect(lang('سلام، حال شما چطور است؟', ['Persian', 'English'])).toBe('Persian');
    expect(lang('我们明天开会', ['Chinese (Simplified)', 'English'])).toBe('Chinese (Simplified)');
    expect(lang('我们明天开会', JA_EN)).toBe('Japanese');
  });
});

describe('pickDirection', () => {
  it('translates primary into secondary and anything else into primary', () => {
    expect(pickDirection('HonyoはSREチームがメンテできる', 'Japanese', 'English')).toEqual({
      source: 'Japanese',
      target: 'English',
    });
    expect(pickDirection('Hello world', 'Japanese', 'English')).toEqual({
      source: 'English',
      target: 'Japanese',
    });
    expect(pickDirection('안녕하세요', 'English', 'Japanese')).toEqual({
      source: 'Korean',
      target: 'English',
    });
  });

  it('separates two Latin-script languages', () => {
    expect(pickDirection('Merci beaucoup pour votre aide', 'French', 'English').target).toBe(
      'English',
    );
    expect(pickDirection('Thank you very much for your help', 'French', 'English').target).toBe(
      'French',
    );
  });
});

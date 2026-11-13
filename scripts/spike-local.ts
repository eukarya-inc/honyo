// Spike: download llama-server + PLaMo 3 Translate and translate from the CLI.
//
//   node scripts/spike-local.ts [--model plamo-3-translate-0.8b] [--dir <base>] \
//        [--primary Japanese] [--secondary English] "text to translate" ...
//
// <base> defaults to the directory the app uses: <userData>/local-models.

import { homedir } from 'os';
import { join } from 'path';
import { parseArgs } from 'util';
import {
  DEFAULT_LOCAL_MODEL,
  installModel,
  installRuntime,
  stopLocalServer,
  translateLocal,
} from '../src/local/index.ts';

function defaultBase(): string {
  const home = homedir();
  const userData =
    process.platform === 'darwin'
      ? join(home, 'Library', 'Application Support', 'honyo')
      : process.platform === 'win32'
        ? join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'honyo')
        : join(process.env.XDG_CONFIG_HOME ?? join(home, '.config'), 'honyo');
  return join(userData, 'local-models');
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: 'string', default: DEFAULT_LOCAL_MODEL },
    dir: { type: 'string', default: defaultBase() },
    primary: { type: 'string', default: 'Japanese' },
    secondary: { type: 'string', default: 'English' },
  },
});
const base = values.dir;

let lastPct = -1;
const onProgress = (what: string, p: { received: number; total: number }): void => {
  const pct = p.total ? Math.floor((p.received / p.total) * 100) : 0;
  if (pct !== lastPct) {
    lastPct = pct;
    process.stderr.write(`\r${what}: ${pct}% (${(p.received / 1e6).toFixed(0)} MB)`);
  }
};

console.error(`base: ${base}`);
let t = Date.now();
console.error(`runtime: ${await installRuntime(base, { onProgress })}`);
lastPct = -1;
console.error(`model: ${await installModel(base, values.model, { onProgress })}`);
console.error(`install/verify: ${Date.now() - t} ms`);

try {
  for (const text of positionals) {
    t = Date.now();
    const r = await translateLocal(base, text, values.primary, values.secondary, {
      modelId: values.model,
    });
    console.log(`[${r.sourceLanguage} -> ${r.targetLanguage}] (${Date.now() - t} ms)`);
    console.log(r.translation);
    console.log('---');
  }
} finally {
  stopLocalServer();
}

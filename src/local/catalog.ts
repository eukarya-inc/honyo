// Pinned downloads for the local translation engine (PLaMo 3 Translate on
// llama.cpp). Everything is pinned by revision/build and verified by SHA-256,
// so a moved tag or a re-uploaded file can never change what runs.
//
// The model is not bundled with the app: the user downloads it straight from
// Hugging Face after accepting the PLaMo Community License.

export interface LocalModelDef {
  /** Config key suffix: the model is selected as `local:<id>`. */
  id: string;
  name: string;
  repo: string;
  revision: string;
  file: string;
  size: number;
  sha256: string;
}

export const LOCAL_MODELS: Record<string, LocalModelDef> = {
  'plamo-3-translate-2b': {
    id: 'plamo-3-translate-2b',
    name: 'PLaMo 3 Translate 2B (Local)',
    repo: 'pfnet/plamo-3-translate-2b-GGUF',
    revision: '4f672106b847200bfdc0f6af6c321cd94eba1aed',
    file: 'plamo-3-translate-2b-Q4_K_M.gguf',
    size: 1807203040,
    sha256: '1ffd9073afcc70e35ccc942428aa2b73d7aa2b9ea779bf504b775369e0276c13',
  },
  'plamo-3-translate-0.8b': {
    id: 'plamo-3-translate-0.8b',
    name: 'PLaMo 3 Translate 0.8B (Local)',
    repo: 'pfnet/plamo-3-translate-0.8b-GGUF',
    revision: '1cf96ae02133958a20074bfdfab76517bb737d00',
    file: 'plamo-3-translate-0.8b-Q4_K_M.gguf',
    size: 573126848,
    sha256: '70891ec70dc7ab4205745a38307867c2881b99239f20327927633abfe4bc9ec6',
  },
};

export const DEFAULT_LOCAL_MODEL = 'plamo-3-translate-2b';

export function modelUrl(m: LocalModelDef): string {
  return `https://huggingface.co/${m.repo}/resolve/${m.revision}/${m.file}`;
}

export interface RuntimeDef {
  build: string;
  asset: string;
  sha256: string;
  /** Archive format of the release asset. */
  format: 'tar.gz' | 'zip';
}

// llama.cpp b12345 includes the PLaMo-3 tokenizer (2026-10-06) and YaRN
// (2026-11-05) fixes. Intel macOS is listed but is not a support target.
const LLAMA_BUILD = 'b12345';
const RUNTIMES: Record<string, Omit<RuntimeDef, 'build'>> = {
  'darwin-arm64': {
    asset: `llama-${LLAMA_BUILD}-bin-macos-arm64.tar.gz`,
    sha256: '2f12877f3bdd1e1ddbbf77f70e075cc52878f81478b90d10aebc28a231bbed3e',
    format: 'tar.gz',
  },
  'darwin-x64': {
    asset: `llama-${LLAMA_BUILD}-bin-macos-x64.tar.gz`,
    sha256: '6439961e7be74f893ffc1ab4c4b21a18375dd9f3297f93fbf8fbf57cae3b7b91',
    format: 'tar.gz',
  },
  // CPU builds: safe everywhere. Vulkan builds are a later option.
  'win32-x64': {
    asset: `llama-${LLAMA_BUILD}-bin-win-cpu-x64.zip`,
    sha256: 'e941d57beeae813d1720b24d9679629c4c13e141f42f7201da8acca27144c1d9',
    format: 'zip',
  },
  'linux-x64': {
    asset: `llama-${LLAMA_BUILD}-bin-ubuntu-x64.tar.gz`,
    sha256: 'a52339d1c8b6c04dcdf04ccfe92db0d3aee06a5bd8201474d232256bc790c308',
    format: 'tar.gz',
  },
};

export function getRuntimeDef(
  platform: string = process.platform,
  arch: string = process.arch,
): RuntimeDef | undefined {
  const def = RUNTIMES[`${platform}-${arch}`];
  return def ? { build: LLAMA_BUILD, ...def } : undefined;
}

export function runtimeUrl(r: RuntimeDef): string {
  return `https://github.com/ggml-org/llama.cpp/releases/download/${r.build}/${r.asset}`;
}

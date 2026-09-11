// Picks the Xel theme that matches the host OS and the current light/dark
// scheme, and keeps it in sync while the window is open. Must run BEFORE
// xel.js is loaded so the initial theme is already declared in <head>.

const THEME_BY_PLATFORM: Record<string, string> = {
  darwin: 'cupertino',
  win32: 'fluent',
  linux: 'adwaita',
};

function themeFile(platform: string, dark: boolean): string {
  const base = THEME_BY_PLATFORM[platform] ?? 'fluent';
  return `node_modules/xel/themes/${base}${dark ? '-dark' : ''}.css`;
}

function setMeta(name: string, content: string): void {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.append(meta);
  }
  meta.content = content;
}

export function applyNativeTheme(platform: string): void {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = (): void => setMeta('xel-theme', themeFile(platform, query.matches));
  apply();
  query.addEventListener('change', apply);
  setMeta('xel-icons', 'node_modules/xel/icons/fluent.svg');
  document.documentElement.dataset.platform = platform;
}

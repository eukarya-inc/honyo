// Toast window (see src/ui/notify.ts). The main process puts the notice in
// the URL fragment as JSON; clicking navigates to #close, which the main
// process watches for. No preload, no IPC.

interface Notice {
  title?: unknown;
  body?: unknown;
}

function render(): void {
  let notice: Notice = {};
  try {
    notice = JSON.parse(decodeURIComponent(location.hash.slice(1))) as Notice;
  } catch {
    // leave empty
  }
  const set = (id: string, value: unknown): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof value === 'string' ? value : '';
  };
  set('title', notice.title);
  set('body', notice.body);
}

render();
document.getElementById('toast')?.addEventListener('click', () => {
  location.hash = 'close';
});

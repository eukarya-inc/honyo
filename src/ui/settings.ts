import { BrowserWindow, ipcMain, app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  getApiKeys,
  updateApiKeys,
  getConfig,
  updateConfig,
  type ApiKeys,
  type CustomModel,
  type ShortcutConfig,
} from '../config/index.ts';
import { getDefaultShortcut, formatShortcut, domCodeToKeycode } from '../keyboard/shortcut.ts';

// Get __dirname in both ESM and CommonJS
const getCurrentDir = (): string => {
  if (typeof import.meta.url !== 'undefined') {
    // ESM
    return dirname(fileURLToPath(import.meta.url));
  } else {
    // CommonJS
    return __dirname;
  }
};

const currentDir = getCurrentDir();

let settingsWindow: BrowserWindow | null = null;

export function openSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    resizable: true,
    minimizable: true,
    maximizable: true,
    title: 'Settings',
  });

  const htmlPath = join(currentDir, '../../settings.html');
  void settingsWindow.loadFile(htmlPath);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

export function setupSettingsIPC(): void {
  ipcMain.on('load-api-keys', event => {
    event.reply('api-keys-loaded', getApiKeys());
  });

  ipcMain.on('save-api-keys', (event, keys: Partial<ApiKeys>) => {
    updateApiKeys(keys);
    event.reply('api-keys-saved', true);
  });

  ipcMain.on('load-custom-prompt', event => {
    const config = getConfig();
    event.reply('custom-prompt-loaded', config.customPrompt);
  });

  ipcMain.on('save-custom-prompt', (event, customPrompt: string) => {
    updateConfig({ customPrompt });
    event.reply('custom-prompt-saved', true);
  });

  ipcMain.on('load-custom-model', event => {
    const config = getConfig();
    event.reply('custom-model-loaded', config.customModel);
  });

  ipcMain.on('save-custom-model', (event, customModel: CustomModel) => {
    updateConfig({ customModel });
    event.reply('custom-model-saved', true);
  });

  ipcMain.on('load-custom-languages', event => {
    const config = getConfig();
    event.reply('custom-languages-loaded', config.customLanguages || []);
  });

  ipcMain.on('save-custom-languages', (event, customLanguages: string[]) => {
    updateConfig({ customLanguages });
    event.reply('custom-languages-saved', true);
  });

  ipcMain.on('load-auto-close-on-blur', event => {
    const config = getConfig();
    event.reply('auto-close-on-blur-loaded', config.autoCloseOnBlur ?? true);
    event.reply('enable-streaming-loaded', config.enableStreaming ?? true);
  });

  ipcMain.on('save-auto-close-on-blur', (event, autoCloseOnBlur: boolean) => {
    updateConfig({ autoCloseOnBlur });
    event.reply('auto-close-on-blur-saved', true);
  });

  ipcMain.on(
    'save-display-settings',
    (event, settings: { autoCloseOnBlur: boolean; enableStreaming: boolean }) => {
      updateConfig({
        autoCloseOnBlur: settings.autoCloseOnBlur,
        enableStreaming: settings.enableStreaming,
      });
      event.reply('display-settings-saved', true);
    },
  );

  ipcMain.on('load-open-at-login', event => {
    const loginSettings = app.getLoginItemSettings();
    event.reply('open-at-login-loaded', loginSettings.openAtLogin);
  });

  ipcMain.on('save-open-at-login', (event, openAtLogin: boolean) => {
    app.setLoginItemSettings({ openAtLogin });
    updateConfig({ openAtLogin });
    event.reply('open-at-login-saved', true);
  });

  ipcMain.on('load-shortcut', event => {
    const config = getConfig();
    const shortcut = config.shortcut ?? getDefaultShortcut();
    event.reply('shortcut-loaded', {
      shortcut,
      display: formatShortcut(shortcut),
    });
  });

  ipcMain.on('save-shortcut', (event, shortcut: ShortcutConfig) => {
    updateConfig({ shortcut });
    event.reply('shortcut-saved', {
      success: true,
      display: formatShortcut(shortcut),
    });
  });

  ipcMain.handle('convert-keycode', (_, code: string) => domCodeToKeycode(code));
}

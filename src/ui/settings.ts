import { BrowserWindow, ipcMain, app, shell, nativeTheme } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';
import { generateText } from 'ai';
import {
  getApiKeys,
  updateApiKeys,
  getConfig,
  updateConfig,
  clearPopupSize,
  getProviderSettings,
  updateProviderBaseUrls,
  listProfiles,
  getActiveProfileId,
  setActiveProfile,
  createProfile,
  renameProfile,
  deleteProfile,
  setProfileShortcut,
  notifyConfigChanged,
  getManagedFields,
  type Config,
  type ApiKeys,
  type ProviderId,
} from '../config/index.ts';
import { languages } from '../language/constants.ts';
import { clearHistory } from '../history/index.ts';
import { getAvailableModels, getDefaultModelKey } from '../models-remote.ts';
import { classifyModelTier } from '../models-tier.ts';
import { DEFAULT_MODEL_KEY } from '../models.ts';
import { resetPopupSize } from './popup.ts';
import { getAIProvider } from '../translation/providers.ts';
import { CUSTOM_MODEL_ID } from '../models.ts';
import { getModelInfo, refreshModels } from '../models-remote.ts';
import {
  SETTINGS_CHANNELS,
  SETTINGS_EVENTS,
  type CreateProfileRequest,
  type GeneratePromptRequest,
  type GeneratePromptResult,
  type ModelOption,
  type ProfileSummary,
  type SettingsPatch,
  type SettingsSnapshot,
} from '../ipc/settings.ts';

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
// Project root in dev (src/ui -> ../..) and in the packaged app (build/ui -> ../..).
const rootDir = join(currentDir, '../..');

let settingsWindow: BrowserWindow | null = null;

export function openSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 840,
    height: 620,
    minWidth: 740,
    minHeight: 420,
    webPreferences: {
      preload: join(rootDir, 'build/preload/settings.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    resizable: true,
    minimizable: true,
    maximizable: true,
    title: 'Settings',
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
  });

  // External links open in the system browser, never in a new Electron window.
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  void settingsWindow.loadFile(join(rootDir, 'settings.html'));

  // Refresh the model list when settings open (respects the 24h cache TTL);
  // rebuilds the tray menu automatically if the list changed.
  void refreshModels();

  // Dev aid: HONYO_SETTINGS_SCREENSHOT=/path/out.png captures the window
  // once it has rendered, then quits. Used to eyeball the UI without a tray.
  // HONYO_SETTINGS_SCREENSHOT_TAB selects a tab and HONYO_THEME=light|dark
  // forces the colour scheme before capturing.
  const screenshotPath = process.env.HONYO_SETTINGS_SCREENSHOT;
  if (screenshotPath) {
    const theme = process.env.HONYO_THEME;
    if (theme === 'light' || theme === 'dark') nativeTheme.themeSource = theme;
    const tab = process.env.HONYO_SETTINGS_SCREENSHOT_TAB;
    settingsWindow.webContents.on('console-message', event => {
      console.log(
        `[renderer:${event.level}] ${event.message} (${event.sourceId}:${event.lineNumber})`,
      );
    });
    settingsWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        void (async (): Promise<void> => {
          // HONYO_SETTINGS_SCREENSHOT_SCRIPT runs arbitrary JS in the page
          // first (e.g. to exercise the profile API before capturing).
          const script = process.env.HONYO_SETTINGS_SCREENSHOT_SCRIPT;
          if (script) {
            await settingsWindow?.webContents.executeJavaScript(script);
            await new Promise(r => setTimeout(r, 500));
          }
          if (tab) {
            await settingsWindow?.webContents.executeJavaScript(
              `document.querySelector('#tabs').value = ${JSON.stringify(tab)};
               document.querySelector('#tabs').dispatchEvent(new CustomEvent('change'));`,
            );
            await new Promise(r => setTimeout(r, 300));
          }
          const image = await settingsWindow?.webContents.capturePage();
          if (image) writeFileSync(screenshotPath, image.toPNG());
          app.quit();
        })();
      }, 1500);
    });
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/** Tell an open settings window that profiles changed elsewhere (tray menu). */
export function notifySettingsProfilesChanged(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send(SETTINGS_EVENTS.profilesChanged);
  }
}

// --- Snapshot mapping ----------------------------------------------------

function modelOptions(): ModelOption[] {
  const defaultName = getModelInfo(DEFAULT_MODEL_KEY)?.name ?? getDefaultModelKey();
  const options: ModelOption[] = [
    { id: DEFAULT_MODEL_KEY, name: `Default (${defaultName})`, group: 'default' },
  ];
  const advanced: ModelOption[] = [];
  for (const provider of ['anthropic', 'openai', 'google', 'xai'] as const) {
    for (const [id, info] of Object.entries(getAvailableModels())) {
      if (info.provider !== provider) continue;
      if (classifyModelTier(info) === 'recommended') {
        options.push({ id, name: info.name, group: provider });
      } else {
        advanced.push({ id, name: info.name, group: 'advanced' });
      }
    }
  }
  options.push(...advanced);
  options.push({ id: CUSTOM_MODEL_ID, name: 'Custom Model', group: 'custom' });
  return options;
}

function snapshot(): SettingsSnapshot {
  const config = getConfig();
  const keys = getApiKeys();
  const providers = getProviderSettings();
  return {
    profiles: listProfiles(),
    activeProfileId: getActiveProfileId(),
    managedFields: getManagedFields(),
    languageOptions: [...languages, ...(config.customLanguages ?? [])],
    modelOptions: modelOptions(),
    targetLanguage: config.targetLanguage,
    secondaryLanguage: config.secondaryLanguage,
    aiModel: config.aiModel,
    profileShortcut: config.shortcut ?? '',
    displayMode: config.displayMode,
    translateTrigger: config.shortcuts?.translateTrigger ?? 'double-copy',
    translateShortcut: config.shortcuts?.translateShortcut ?? '',
    translateSource: config.shortcuts?.translateSource ?? 'copy-selection',
    anthropicKey: keys.anthropic ?? '',
    openaiKey: keys.openai ?? '',
    googleKey: keys.google ?? '',
    xaiKey: keys.xai ?? '',
    anthropicBaseUrl: providers.anthropic.baseUrl ?? '',
    openaiBaseUrl: providers.openai.baseUrl ?? '',
    googleBaseUrl: providers.google.baseUrl ?? '',
    xaiBaseUrl: providers.xai.baseUrl ?? '',
    customPrompt: config.customPrompt ?? '',
    customModelName: config.customModel?.model ?? '',
    customModelProvider: config.customModel?.provider ?? '',
    customLanguages: (config.customLanguages ?? []).join('\n'),
    autoCloseOnBlur: config.autoCloseOnBlur ?? true,
    enableStreaming: config.enableStreaming ?? true,
    popupFontSize: config.popupFontSize ?? 14,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    historyEnabled: config.historyEnabled !== false,
  };
}

function applyPatch(patch: SettingsPatch): void {
  const keyUpdates: Partial<ApiKeys> = {};
  if (patch.anthropicKey !== undefined) keyUpdates.anthropic = patch.anthropicKey.trim();
  if (patch.openaiKey !== undefined) keyUpdates.openai = patch.openaiKey.trim();
  if (patch.googleKey !== undefined) keyUpdates.google = patch.googleKey.trim();
  if (patch.xaiKey !== undefined) keyUpdates.xai = patch.xaiKey.trim();
  if (Object.keys(keyUpdates).length > 0) updateApiKeys(keyUpdates);

  const baseUrls: Partial<Record<ProviderId, string>> = {};
  if (patch.anthropicBaseUrl !== undefined) baseUrls.anthropic = patch.anthropicBaseUrl;
  if (patch.openaiBaseUrl !== undefined) baseUrls.openai = patch.openaiBaseUrl;
  if (patch.googleBaseUrl !== undefined) baseUrls.google = patch.googleBaseUrl;
  if (patch.xaiBaseUrl !== undefined) baseUrls.xai = patch.xaiBaseUrl;
  if (Object.keys(baseUrls).length > 0) updateProviderBaseUrls(baseUrls);

  const updates: Partial<Config> = {};
  // Languages: keep primary and secondary distinct by swapping, as the tray does.
  const current = getConfig();
  const target = patch.targetLanguage ?? current.targetLanguage;
  const secondary = patch.secondaryLanguage ?? current.secondaryLanguage;
  if (patch.targetLanguage !== undefined || patch.secondaryLanguage !== undefined) {
    if (target === secondary) {
      updates.targetLanguage = target;
      updates.secondaryLanguage =
        patch.targetLanguage !== undefined ? current.targetLanguage : current.secondaryLanguage;
      if (updates.secondaryLanguage === target) updates.secondaryLanguage = current.targetLanguage;
    } else {
      updates.targetLanguage = target;
      updates.secondaryLanguage = secondary;
    }
  }
  if (patch.aiModel !== undefined) updates.aiModel = patch.aiModel;
  if (patch.displayMode !== undefined) updates.displayMode = patch.displayMode;
  if (
    patch.translateTrigger !== undefined ||
    patch.translateShortcut !== undefined ||
    patch.translateSource !== undefined
  ) {
    const prev = current.shortcuts ?? {
      translateTrigger: 'double-copy' as const,
      translateSource: 'copy-selection' as const,
    };
    const translateShortcut = (patch.translateShortcut ?? prev.translateShortcut ?? '').trim();
    updates.shortcuts = {
      translateTrigger: patch.translateTrigger ?? prev.translateTrigger,
      translateSource: patch.translateSource ?? prev.translateSource,
      ...(translateShortcut ? { translateShortcut } : {}),
    };
  }
  if (patch.profileShortcut !== undefined) {
    setProfileShortcut(getActiveProfileId(), patch.profileShortcut);
  }
  if (patch.customPrompt !== undefined) updates.customPrompt = patch.customPrompt.trim();
  if (patch.customLanguages !== undefined) {
    updates.customLanguages = patch.customLanguages
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
  }
  if (patch.customModelName !== undefined || patch.customModelProvider !== undefined) {
    const existing = current.customModel;
    const model = (patch.customModelName ?? existing?.model ?? '').trim();
    const provider = patch.customModelProvider ?? existing?.provider ?? '';
    if (provider !== '') updates.customModel = { model, provider };
    else if (existing) updates.customModel = { model, provider: existing.provider };
  }
  if (patch.autoCloseOnBlur !== undefined) updates.autoCloseOnBlur = patch.autoCloseOnBlur;
  if (patch.enableStreaming !== undefined) updates.enableStreaming = patch.enableStreaming;
  if (typeof patch.popupFontSize === 'number' && !Number.isNaN(patch.popupFontSize)) {
    updates.popupFontSize = Math.min(24, Math.max(10, Math.round(patch.popupFontSize)));
  }
  if (patch.historyEnabled !== undefined) updates.historyEnabled = patch.historyEnabled;
  if (patch.openAtLogin !== undefined) {
    app.setLoginItemSettings({ openAtLogin: patch.openAtLogin });
    updates.openAtLogin = patch.openAtLogin;
  }
  if (Object.keys(updates).length > 0) updateConfig(updates);
}

// --- Prompt generation -----------------------------------------------------

async function generateCustomPrompt(data: GeneratePromptRequest): Promise<GeneratePromptResult> {
  try {
    const config = getConfig();
    const apiKeys = getApiKeys();

    let apiKey: string | undefined;
    if (config.aiModel === CUSTOM_MODEL_ID) {
      if (!config.customModel?.provider) {
        return { success: false, error: 'Custom model not configured' };
      }
      apiKey = apiKeys[config.customModel.provider];
    } else {
      const modelInfo = getModelInfo(config.aiModel);
      if (modelInfo) apiKey = apiKeys[modelInfo.provider];
    }
    if (!apiKey) return { success: false, error: 'API key not configured' };

    const model = getAIProvider(config.aiModel, apiKeys, config.customModel, getProviderSettings());

    const systemPrompt = `You are an expert at writing translation instruction prompts.
Your task is to generate or modify a custom prompt that will be used to guide AI translations.

Rules:
1. Output ONLY the custom prompt text, no explanations or meta-commentary
2. Write the prompt in English for best results
3. Keep instructions clear, concise, and actionable
4. Focus on translation style, tone, terminology preferences, etc.
5. If there's an existing prompt, improve or modify it based on the user's request
6. If no existing prompt, create a new one based on the user's request`;

    const userPrompt = data.currentPrompt
      ? `Current custom prompt:\n${data.currentPrompt}\n\nUser's request: ${data.instruction}`
      : `User's request: ${data.instruction}`;

    const { text } = await generateText({ model, system: systemPrompt, prompt: userPrompt });
    return { success: true, prompt: text.trim() };
  } catch (error) {
    console.error('Failed to generate custom prompt:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// --- IPC ---------------------------------------------------------------------

export function setupSettingsIPC(): void {
  ipcMain.handle(SETTINGS_CHANNELS.load, (): SettingsSnapshot => snapshot());

  ipcMain.handle(SETTINGS_CHANNELS.save, (_event, patch: SettingsPatch): void => {
    applyPatch(patch);
    // Languages, model and display mode are shown in the tray: rebuild it.
    notifyConfigChanged();
  });

  ipcMain.handle(SETTINGS_CHANNELS.resetPopupSize, (): void => {
    clearPopupSize();
    // Resize the popup immediately if one is currently open.
    resetPopupSize();
  });

  ipcMain.handle(SETTINGS_CHANNELS.generatePrompt, (_event, data: GeneratePromptRequest) =>
    generateCustomPrompt(data),
  );

  ipcMain.handle(SETTINGS_CHANNELS.openExternal, async (_event, url: string): Promise<void> => {
    if (/^https?:\/\//.test(url)) await shell.openExternal(url);
  });

  ipcMain.handle(SETTINGS_CHANNELS.profileSelect, (_event, id: string): void => {
    setActiveProfile(id);
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.profileCreate,
    (_event, request: CreateProfileRequest): ProfileSummary =>
      createProfile(request.name, request.duplicateFrom),
  );

  ipcMain.handle(SETTINGS_CHANNELS.profileRename, (_event, id: string, name: string): void => {
    renameProfile(id, name);
  });

  ipcMain.handle(SETTINGS_CHANNELS.clearHistory, (): void => {
    clearHistory();
  });

  ipcMain.handle(SETTINGS_CHANNELS.profileDelete, (_event, id: string): boolean =>
    deleteProfile(id),
  );
}

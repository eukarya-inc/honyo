import type { Tray, MenuItemConstructorOptions } from 'electron';
import { Menu, app } from 'electron';
import { uIOhook } from 'uiohook-napi';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { languages } from '../language/index.ts';
import { CUSTOM_MODEL_ID, DEFAULT_MODEL_KEY, type AIModelInfo } from '../models.ts';
import { getAvailableModels, getModelInfo, getDefaultModelKey } from '../models-remote.ts';
import { classifyModelTier, type ModelTier } from '../models-tier.ts';
import {
  getConfig,
  updateConfig,
  getPausedState,
  setPausedState,
  listProfiles,
  getActiveProfileId,
  setActiveProfile,
} from '../config/index.ts';
import { openSettingsWindow } from './settings.ts';
import {
  checkForUpdates,
  isCheckingUpdate,
  isDownloadingUpdate,
  getDownloadProgress,
} from '../app/updater.ts';
import { cancelCurrentTranslation, isCurrentlyTranslating } from '../keyboard/handler.ts';
import { closePopup } from './popup.ts';
import { formatAccelerator } from '../keyboard/accelerator.ts';
import { listHistory, clearHistory } from '../history/index.ts';
import { previewText } from '../history/store.ts';
import { clipboard } from 'electron';

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

// Get version from package.json
let appVersion = '';
try {
  const packageContent = readFileSync(join(currentDir, '../../package.json'), 'utf-8');
  const packageJson = JSON.parse(packageContent) as { version?: string };
  appVersion = packageJson.version ?? '';
} catch (error) {
  console.error('Failed to read package.json version:', error);
}

// Number of recent results listed in the tray's History submenu.
const HISTORY_MENU_ITEMS = 15;

// Human-readable description of how a translation is triggered.
export function describeTranslateTrigger(): string {
  const shortcuts = getConfig().shortcuts;
  if (shortcuts?.translateTrigger === 'shortcut' && shortcuts.translateShortcut) {
    return formatAccelerator(shortcuts.translateShortcut, process.platform);
  }
  return process.platform === 'darwin' ? 'Double ⌘C' : 'Double Ctrl+C';
}

export function createTrayMenu(tray: Tray | null, updateTrayTitle: (title: string) => void): Menu {
  const config = getConfig();
  const isPaused = getPausedState();

  // Combine default languages with custom languages
  const allLanguages = [...languages];
  if (config.customLanguages && config.customLanguages.length > 0) {
    allLanguages.push(...config.customLanguages);
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Honyo Translator ${appVersion ? `v${appVersion}` : ''}`,
      type: 'normal',
      enabled: false,
    },
    {
      label: `Translate: ${describeTranslateTrigger()}`,
      type: 'normal',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: `Profile: ${listProfiles().find(p => p.id === getActiveProfileId())?.name ?? ''}`,
      submenu: [
        ...listProfiles().map(profile => ({
          label: profile.name,
          type: 'radio' as const,
          checked: profile.id === getActiveProfileId(),
          // Display only: the shortcut itself is registered via globalShortcut.
          ...(profile.shortcut
            ? { accelerator: profile.shortcut, registerAccelerator: false }
            : {}),
          click: (): void => {
            // setActiveProfile triggers the profile-changed callback, which
            // rebuilds this menu with the new languages/model.
            setActiveProfile(profile.id);
          },
        })),
        { type: 'separator' as const },
        {
          label: 'Manage Profiles…',
          click: (): void => {
            openSettingsWindow();
          },
        },
      ],
    },
    {
      label: `Primary: ${config.targetLanguage}`,
      submenu: allLanguages.map(lang => ({
        label: lang,
        type: 'radio',
        checked: config.targetLanguage === lang,
        click: (): void => {
          if (config.secondaryLanguage === lang) {
            // Swap languages if same language selected
            updateConfig({
              targetLanguage: lang,
              secondaryLanguage: config.targetLanguage,
            });
          } else {
            updateConfig({ targetLanguage: lang });
          }
          tray?.setContextMenu(createTrayMenu(tray, updateTrayTitle));
        },
      })),
    },
    {
      label: `Secondary: ${config.secondaryLanguage}`,
      submenu: allLanguages.map(lang => ({
        label: lang,
        type: 'radio',
        checked: config.secondaryLanguage === lang,
        click: (): void => {
          if (config.targetLanguage === lang) {
            // Swap languages if same language selected
            updateConfig({
              targetLanguage: config.secondaryLanguage,
              secondaryLanguage: lang,
            });
          } else {
            updateConfig({ secondaryLanguage: lang });
          }
          tray?.setContextMenu(createTrayMenu(tray, updateTrayTitle));
        },
      })),
    },
    { type: 'separator' },
    {
      label: 'Display Mode',
      submenu: [
        {
          label: 'Notification && Copy',
          type: 'radio',
          checked: config.displayMode === 'notification',
          click: (): void => {
            updateConfig({ displayMode: 'notification' });
            tray?.setContextMenu(createTrayMenu(tray, updateTrayTitle));
          },
        },
        {
          label: 'Popup Window',
          type: 'radio',
          checked: config.displayMode === 'popup',
          click: (): void => {
            updateConfig({ displayMode: 'popup' });
            tray?.setContextMenu(createTrayMenu(tray, updateTrayTitle));
          },
        },
      ],
    },
    {
      label: `AI Model: ${
        config.aiModel === CUSTOM_MODEL_ID
          ? 'Custom Model'
          : config.aiModel === DEFAULT_MODEL_KEY
            ? `Default (${getModelInfo(DEFAULT_MODEL_KEY)?.name ?? getDefaultModelKey()})`
            : (getModelInfo(config.aiModel)?.name ?? 'Unknown')
      }`,
      submenu: ((): MenuItemConstructorOptions[] => {
        const select = (modelId: string): void => {
          updateConfig({ aiModel: modelId });
          tray?.setContextMenu(createTrayMenu(tray, updateTrayTitle));
        };
        const radio = (modelId: string, modelInfo: AIModelInfo): MenuItemConstructorOptions => ({
          label: modelInfo.name,
          type: 'radio',
          checked: config.aiModel === modelId,
          click: (): void => select(modelId),
        });

        // Group models by provider and tier. Recommended (fast, adequate)
        // models are listed directly; advanced (overkill for translation)
        // models are folded into a collapsed submenu.
        type Entry = [string, AIModelInfo];
        const byProvider = (tier: ModelTier): Record<AIModelInfo['provider'], Entry[]> => {
          const groups: Record<AIModelInfo['provider'], Entry[]> = {
            anthropic: [],
            openai: [],
            google: [],
          };
          for (const [modelId, modelInfo] of Object.entries(getAvailableModels())) {
            if (classifyModelTier(modelInfo) === tier) {
              groups[modelInfo.provider].push([modelId, modelInfo]);
            }
          }
          return groups;
        };
        const flatten = (groups: Record<string, Entry[]>): MenuItemConstructorOptions[] => {
          const items: MenuItemConstructorOptions[] = [];
          for (const entries of Object.values(groups)) {
            if (entries.length === 0) continue;
            if (items.length > 0) items.push({ type: 'separator' });
            for (const [modelId, modelInfo] of entries) items.push(radio(modelId, modelInfo));
          }
          return items;
        };

        // "Default" follows the app-recommended model across releases.
        const menuItems: MenuItemConstructorOptions[] = [
          {
            label: `Default (${getModelInfo(DEFAULT_MODEL_KEY)?.name ?? getDefaultModelKey()})`,
            type: 'radio',
            checked: config.aiModel === DEFAULT_MODEL_KEY,
            click: (): void => select(DEFAULT_MODEL_KEY),
          },
          { type: 'separator' },
          ...flatten(byProvider('recommended')),
        ];
        const advanced = flatten(byProvider('advanced'));
        if (advanced.length > 0) {
          menuItems.push({ type: 'separator' });
          menuItems.push({ label: 'Advanced Models', submenu: advanced });
        }

        menuItems.push({ type: 'separator' });
        menuItems.push({
          label: 'Custom Model',
          type: 'radio',
          checked: config.aiModel === CUSTOM_MODEL_ID,
          click: (): void => select(CUSTOM_MODEL_ID),
        });

        return menuItems;
      })(),
    },
    ...(config.historyEnabled !== false
      ? [
          {
            label: 'History',
            submenu: ((): MenuItemConstructorOptions[] => {
              const entries = listHistory().slice(0, HISTORY_MENU_ITEMS);
              const items: MenuItemConstructorOptions[] = entries.map(entry => ({
                label: previewText(entry.output),
                // macOS shows these as a second line / hover text.
                sublabel: previewText(entry.input),
                toolTip:
                  entry.output.length > 400 ? entry.output.slice(0, 400) + '…' : entry.output,
                click: (): void => {
                  clipboard.writeText(entry.output);
                },
              }));
              if (items.length === 0) items.push({ label: 'No history yet', enabled: false });
              items.push({ type: 'separator' });
              items.push({
                label: 'Clear History',
                enabled: entries.length > 0,
                click: (): void => {
                  clearHistory();
                },
              });
              return items;
            })(),
          },
        ]
      : []),
    {
      label: 'Settings...',
      click: (): void => {
        openSettingsWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Pause Translation',
      type: 'checkbox',
      checked: isPaused,
      click: (): void => {
        setPausedState(!isPaused);
        console.log(`Translation ${getPausedState() ? 'paused' : 'resumed'}`);
        tray?.setContextMenu(createTrayMenu(tray, updateTrayTitle));
      },
    },
    {
      label: 'Stop Current Translation',
      enabled: isCurrentlyTranslating(),
      click: (): void => {
        cancelCurrentTranslation();
        closePopup();
        tray?.setContextMenu(createTrayMenu(tray, updateTrayTitle));
      },
    },
    { type: 'separator' },
    {
      label: isDownloadingUpdate()
        ? `Downloading Update (${getDownloadProgress()}%)...`
        : isCheckingUpdate()
          ? 'Checking for Updates...'
          : 'Check for Updates...',
      enabled: !isCheckingUpdate() && !isDownloadingUpdate(),
      click: (): void => {
        checkForUpdates();
      },
    },
    {
      label: 'Quit',
      click: (): void => {
        console.log('Quit menu clicked');
        // Stop uIOhook
        try {
          uIOhook.stop();
        } catch (error) {
          console.error('Error stopping uIOhook:', error);
        }

        // Destroy tray icon
        if (tray) {
          tray.destroy();
        }

        // Force quit app
        app.exit(0);
      },
    },
  ]);

  return contextMenu;
}

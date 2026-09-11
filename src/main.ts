import './app/dev-userdata.ts';
import { app } from 'electron';
import { initializeConfig, getConfig } from './config/index.ts';
import { loadModelsCache, refreshModels, setSelectedModelProvider } from './models-remote.ts';
import { createTray, setupSettingsIPC } from './ui/index.ts';
import { openSettingsWindow } from './ui/settings.ts';
import { setupKeyboardHandler, startKeyboardListener } from './keyboard/index.ts';
import { registerShortcuts, unregisterShortcuts } from './keyboard/shortcuts.ts';
import { setProfileChangedCallback, notifyConfigChanged } from './config/index.ts';
import { registerAction } from './actions/registry.ts';
import { runAction } from './actions/run.ts';
import { translateAction } from './actions/translate.ts';
import { onHistoryChanged } from './history/index.ts';
import {
  setupSingleInstance,
  setupPlatformSpecific,
  setupShutdownHandlers,
  checkAccessibilityPermission,
} from './app/index.ts';
import {
  setupPopupIPC,
  showTranslationPopup,
  updatePopupLanguages,
  debugCapturePopup,
} from './ui/popup.ts';
import { setupAutoUpdater } from './app/updater.ts';

// Initialize the app
function initialize(): void {
  // Check for single instance
  if (!setupSingleInstance()) {
    app.quit();
    return;
  }

  // Platform specific setup
  setupPlatformSpecific();

  // Setup shutdown handlers
  setupShutdownHandlers();

  // When app is ready
  void app.whenReady().then(async () => {
    console.log('App ready, starting key listener...');
    console.log('API Key present:', !!process.env.ANTHROPIC_API_KEY);

    // Check accessibility permission on macOS
    const hasPermission = await checkAccessibilityPermission();
    if (!hasPermission) {
      return; // App will quit
    }

    // Initialize configuration
    initializeConfig();

    // Pin the currently-selected model so the model-list cap never drops it
    setSelectedModelProvider(() => getConfig().aiModel);

    // Load cached model list (synchronous) before building the tray menu
    loadModelsCache();

    // Built-in actions
    registerAction(translateAction);

    // Setup auto-updater
    setupAutoUpdater();

    // Create tray icon
    createTray();

    // Refresh the model list in the background; rebuilds the tray menu on change
    void refreshModels();

    // Setup IPC for settings window
    setupSettingsIPC();

    // Setup IPC for popup window
    setupPopupIPC();

    // Dev aid: HONYO_OPEN_SETTINGS=1 opens the settings window on launch.
    if (process.env.HONYO_OPEN_SETTINGS) openSettingsWindow();

    // Dev aid: HONYO_POPUP_SCREENSHOT=path captures a sample popup and quits.
    const popupShot = process.env.HONYO_POPUP_SCREENSHOT;
    if (popupShot) {
      showTranslationPopup('こんにちは、世界。これはサンプルの翻訳です。', 'Hello, world.');
      updatePopupLanguages('English', 'Japanese');
      debugCapturePopup(popupShot);
    }

    // Setup keyboard handler
    setupKeyboardHandler();

    // Global shortcuts (custom translate trigger, profile switching); kept in
    // sync with config changes.
    registerShortcuts();
    setProfileChangedCallback(() => registerShortcuts());
    app.on('will-quit', unregisterShortcuts);

    // History entries appear in the tray menu
    onHistoryChanged(notifyConfigChanged);

    // Dev aid: HONYO_DEBUG_ECHO=<text> runs a no-network "echo" action through
    // the full pipeline (popup/notification + history) and quits.
    const echoText = process.env.HONYO_DEBUG_ECHO;
    if (echoText) {
      registerAction({
        id: 'echo',
        name: 'Echo',
        accepts: ['text'],
        run: async (input, ctx) => {
          const text = input.kind === 'text' ? `echo: ${input.text}` : '';
          ctx.onMeta?.({ sourceLanguage: 'Test', targetLanguage: 'Echo' });
          ctx.onChunk?.(text);
          return { text };
        },
      });
      void runAction('echo', { kind: 'text', text: echoText }).then(() => {
        setTimeout(() => app.quit(), 800);
      });
    }

    // Start listening for keyboard events
    try {
      startKeyboardListener();
    } catch (error) {
      console.error('Failed to start keyboard listener:', error);
      app.quit();
    }
  });
}

// Start the application
initialize();

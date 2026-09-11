import './app/dev-userdata.ts';
import { app } from 'electron';
import { initializeConfig, getConfig } from './config/index.ts';
import { loadModelsCache, refreshModels, setSelectedModelProvider } from './models-remote.ts';
import { createTray, setupSettingsIPC } from './ui/index.ts';
import { openSettingsWindow } from './ui/settings.ts';
import { setupKeyboardHandler, startKeyboardListener } from './keyboard/index.ts';
import {
  setupSingleInstance,
  setupPlatformSpecific,
  setupShutdownHandlers,
  checkAccessibilityPermission,
} from './app/index.ts';
import { setupPopupIPC } from './ui/popup.ts';
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

    // Setup keyboard handler
    setupKeyboardHandler();

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

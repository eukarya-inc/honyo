import { app, dialog, shell, systemPreferences } from 'electron';
import { execSync } from 'child_process';

function getActualBundleId(): string {
  if (!app.isPackaged) {
    return 'com.electron.electron';
  }

  try {
    // Get the app bundle path and construct Info.plist path
    const appPath = app.getPath('exe');
    // Remove the executable name and MacOS directory to get Contents path
    const contentsPath = appPath.substring(0, appPath.lastIndexOf('/MacOS'));
    const plistPath = `${contentsPath}/Info.plist`;

    console.log('Reading bundle ID from:', plistPath);
    return execSync(`defaults read "${plistPath}" CFBundleIdentifier`).toString().trim();
  } catch (error) {
    console.error('Failed to read bundle ID from Info.plist:', error);
    return 'com.rot1024.honyo'; // Fallback to expected bundle ID
  }
}

export async function checkAccessibilityPermission(): Promise<boolean> {
  // Only check on macOS
  if (process.platform !== 'darwin') {
    return true;
  }

  console.log('Checking accessibility permissions...');
  console.log('App path:', app.getPath('exe'));
  console.log('App name:', app.getName());
  console.log('Process path:', process.execPath);
  console.log('Is packaged:', app.isPackaged);

  const actualBundleId = getActualBundleId();
  console.log('Actual Bundle ID:', actualBundleId);

  // First try without prompting
  let isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
  console.log('Is trusted (no prompt):', isTrusted);

  if (!isTrusted && app.isPackaged) {
    // For packaged apps, try with prompt
    isTrusted = systemPreferences.isTrustedAccessibilityClient(true);
    console.log('Is trusted (with prompt):', isTrusted);
  }

  if (!isTrusted) {
    console.log('Showing accessibility dialog...');

    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Accessibility Permission Required',
      message: 'Honyo needs accessibility permission to detect keyboard shortcuts.',
      detail:
        'Please grant accessibility permission in System Preferences > Security & Privacy > Privacy > Accessibility.\n\n' +
        'The app will now open System Preferences and quit. Please restart Honyo after granting permission.',
      buttons: ['Open System Preferences', 'Quit'],
      defaultId: 0,
      cancelId: 1,
    });

    console.log('Dialog result:', result);

    if (result.response === 0) {
      console.log('Opening System Preferences...');
      // Open System Preferences to the Privacy > Accessibility pane
      const opened = await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      );
      console.log('System Preferences opened:', opened);
      // Wait a bit for System Preferences to open
      console.log('Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Wait complete');
    }

    // Quit the app
    console.log('Quitting app...');
    app.quit();
    return false;
  }

  return true;
}

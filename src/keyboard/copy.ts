// Ask the frontmost application to copy its selection, so a custom shortcut
// that is not itself a copy chord can still translate the selected text.
import { exec } from 'child_process';
import { clipboard } from 'electron';

function run(command: string): Promise<void> {
  return new Promise(resolve => {
    exec(command, error => {
      if (error) console.error('Simulated copy failed:', error);
      resolve();
    });
  });
}

/**
 * Send the platform's copy chord to the active app and wait for the
 * clipboard to update. Resolves with the new clipboard text, or the previous
 * text if nothing changed within the timeout (e.g. no selection).
 */
export async function copySelectionToClipboard(timeoutMs = 400): Promise<string> {
  const before = clipboard.readText();
  // Clear so an unchanged clipboard can be told apart from a re-copied one.
  clipboard.writeText('');

  switch (process.platform) {
    case 'darwin':
      // Requires the accessibility permission Honyo already asks for.
      await run(
        `osascript -e 'tell application "System Events" to keystroke "c" using command down'`,
      );
      break;
    case 'win32':
      await run(
        `powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys('^c')"`,
      );
      break;
    default:
      // xdotool is the common X11 tool; on Wayland this may be unavailable.
      await run('xdotool key --clearmodifiers ctrl+c');
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = clipboard.readText();
    if (text) return text;
    await new Promise(r => setTimeout(r, 40));
  }
  // Nothing was copied: restore the previous clipboard and report it.
  clipboard.writeText(before);
  return before;
}

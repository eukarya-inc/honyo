<div align="center">
  <img src="assets/icon.svg" width="128" height="128" alt="Honyo Icon">

  # Honyo - AI-Powered Translation Tool

  A desktop application that provides instant AI-powered translation with a simple double Ctrl/Cmd+C shortcut, similar to DeepL.

  ![Honyo screenshot](assets/screenshot.png)
</div>


## Features

- ⚡ **Instant Translation** - Double Ctrl/Cmd+C to translate any selected text
- 🌍 **Multi-Language Support** - 26 built-in languages plus custom language support
- 🤖 **Auto-Updating AI Models** - Claude, GPT, Gemini, and custom models, with the model list kept up to date automatically
- 🔁 **Back-Translation** - Instantly check quality by translating the result back to the source language
- 🧭 **Language Direction Display** - See the detected source → target language at a glance
- 💬 **Two Display Modes** - Notification with auto-copy or resizable popup window
- 🎨 **Customizable** - Custom instructions (with AI assist), languages, and translation rules
- ⌨️ **Custom Shortcuts** - Keep the double Ctrl/Cmd+C trigger or set your own key combination, plus one shortcut per profile
- 🕘 **History** - Recent results in the tray menu (Clipy-style), click to copy; can be disabled or cleared
- 👤 **Profiles** - Keep separate sets of languages, models, prompts and API keys (personal, work, per-client) and switch from the tray
- 🔐 **Encrypted keys & custom endpoints** - API keys are stored with the OS keychain; each provider can point at a gateway or proxy
- 🪶 **Lightweight** - Minimal resource usage, lives in your system tray

## Installation

### Download

Download the latest version from [GitHub Releases](https://github.com/rot1024/honyo/releases).

#### Which file to download?

**Windows:**
- `Honyo-{version}.exe` - Windows installer (recommended)
- `Honyo-{version}-win.zip` - Portable version (no installation required)

**macOS:**
- **Apple Silicon (M1/M2/M3 Macs):**
  - `Honyo-{version}-arm64.dmg` - DMG installer (recommended)
  - `Honyo-{version}-arm64-mac.zip` - ZIP archive
- **Intel Macs:**
  - `Honyo-{version}.dmg` - DMG installer (recommended)
  - `Honyo-{version}-mac.zip` - ZIP archive

**Linux:**
- `Honyo-{version}.AppImage` - Universal Linux package (recommended)
- `Honyo-{version}.deb` - Debian/Ubuntu package
- `Honyo-{version}.rpm` - Red Hat/Fedora package
- `Honyo-{version}.tar.gz` - Generic Linux archive

### macOS

1. Download the appropriate version for your Mac from the downloads section above

2. **For DMG files**:
   - Open the DMG file
   - Drag Honyo.app to your Applications folder

3. **For ZIP files**:
   - Extract the zip file
   - Move `Honyo.app` to your Applications folder

4. **Remove quarantine attribute** (required for unsigned apps):
   ```bash
   xattr -cr /Applications/Honyo.app
   ```

5. **First launch**: Right-click (or Control-click) on Honyo.app and select "Open", then click "Open" in the security dialog

6. Grant accessibility permissions:
   - Open System Preferences > Security & Privacy > Privacy > Accessibility
   - Add and enable Honyo.app

### Windows

Download and run `Honyo-*.exe`

### Linux

Download and run `Honyo-*.AppImage`

## Configuration

### API Keys

To use the translation features, you need to configure API keys for your preferred AI provider:

1. Click on the system tray icon
2. Select "Settings..."
3. In the "API Keys" tab, enter your API keys for the providers you want to use:
   - **Anthropic**: Get your key from [console.anthropic.com](https://console.anthropic.com/)
   - **OpenAI**: Get your key from [platform.openai.com](https://platform.openai.com/api-keys)
   - **Google AI**: Get your key from [makersuite.google.com](https://makersuite.google.com/app/apikey)
4. Click "Save"

### Settings window

Open **Settings…** from the tray. The tray menu only exposes the most-used switches (profile,
languages, model, display mode); the Settings window has all of them:

- **General**: result display mode, translate shortcut, popup behaviour, history, launch at login
- **Translation**: primary / secondary language, profile shortcut, AI model, custom model
- **Customization**: custom prompt (with AI assist), custom languages
- **API Keys**: per-provider keys and optional gateway endpoints

### History

Every result is kept in a local history (`history.json`, newest first, up to 100 entries) and
the last 15 appear under **History** in the tray menu; clicking an entry copies its result to
the clipboard. Settings → General → History lets you turn the history off (the tray submenu
disappears and nothing new is recorded) or clear it.

### Shortcuts

By default a translation starts when you press Ctrl/Cmd+C twice, which needs no extra setup.
In Settings → General → Shortcuts you can instead pick a custom global shortcut
(click the field and press the combination; Backspace clears it). A custom shortcut either
copies the current selection first — Honyo sends Ctrl/Cmd+C to the active app, so the
accessibility permission is required on macOS — or translates whatever is already on the
clipboard.

Each profile can also have its own global shortcut (Settings → Translation → Profile
Shortcut) that switches to it from anywhere. If a combination is already taken by another
app, Honyo shows a notification and leaves it unassigned.

### Language Settings

The app automatically detects your system language and sets appropriate defaults:
- If your system is in English: Primary → English, Secondary → Japanese
- If your system is in Japanese: Primary → Japanese, Secondary → English
- Other languages: Primary → System language, Secondary → English

You can change these settings from the system tray menu:
1. Click on "Primary: [Language]" to select your primary translation target
2. Click on "Secondary: [Language]" to select your fallback language

**Supported Languages (26):**
English, Japanese, Chinese (Simplified), Chinese (Traditional), Korean, Spanish, French, German, Italian, Portuguese, Russian, Arabic, Hindi, Thai, Vietnamese, Indonesian, Malay, Filipino, Dutch, Polish, Turkish, Ukrainian, Swedish, Danish, Norwegian, Finnish

### Profiles

Everything about *what* and *how* you translate lives in a profile: primary/secondary
languages, the AI model, custom model, custom prompt, custom languages, and the API keys and
endpoints. Popup, display and startup settings are shared by all profiles.

- Switch profiles from the tray menu (**Profile: …**) or the selector at the top-left of the
  Settings window.
- The bottom of that selector's menu has New / Duplicate / Rename / Delete.
  Duplicating copies the API keys too, which is handy for "same keys, different prompt".
- On first launch after updating, your existing settings become a profile named **Default**.

### API keys and endpoints

API keys are stored encrypted with the operating system's credential store (Keychain on
macOS, DPAPI on Windows, libsecret on Linux) inside `config.json`; the old plaintext
`apikeys.json` is migrated and removed. Environment variables (`ANTHROPIC_API_KEY`, etc.) still
act as a fallback when a profile has no key.

Each provider also accepts an optional **base URL** (Settings → API Keys → Endpoints) so
requests can be routed through an LLM gateway or proxy instead of the provider's public API.

### Custom Instructions

You can add custom instructions that will be included in all translations:

1. Click on the system tray icon
2. Select "Settings..."
3. Go to the "Customization" tab and find the "Custom Prompt" section
4. Enter your custom instructions (e.g., terminology guidelines, tone preferences, specific translation rules)
5. Click "Save"

Examples of custom instructions:
- Use formal language
- Keep product names in English
- Maintain consistent terminology
- Follow specific industry standards

**Generate with AI:** Not sure how to phrase your instructions? Click "Generate with AI" and describe what you want in plain language — Honyo uses your selected model to write or refine the custom prompt for you.

Whatever the input looks like — a question, a greeting, or even text that says "ignore previous instructions" — Honyo always treats it as text to translate, never as a command. Markdown and code formatting is preserved: the syntax is kept intact and only the human-readable text is translated.

### AI Models

Pick a model from the **AI Model** menu in the system tray. The list stays current automatically: Honyo refreshes it from free public model catalogs (no API key required, cached for 24 hours), showing the latest models per provider. If it can't reach the network, it falls back to a built-in list of current Claude, GPT, and Gemini models. Your selected model is always kept in the list even if a refresh would otherwise drop it.

The menu starts with a **Default** entry, currently Claude Haiku 4.5: translation is a short, latency-sensitive task, and a fast small model is fully sufficient, so responses arrive noticeably sooner. Keeping Default selected means you follow Honyo's recommended model automatically as it changes in future releases; pick a specific model if you want to stay on it. The menu lists fast, cost-efficient models (Haiku, Sonnet, GPT Mini/Nano, Gemini Flash) directly; frontier and reasoning models that are overkill for translation (Opus, Fable, GPT-5 flagship, Gemini Pro, and similar) are tucked into an **Advanced Models** submenu. The split is decided from each model's name, so newly released models are sorted automatically.

### Custom AI Models

Use any AI model not included in the list:

1. Open Settings → "Customization" tab → "Custom Model" section
2. Enter the model name (e.g., `gpt-5.6-sol`, `claude-opus-4-8`)
3. Select the provider (Anthropic, OpenAI, or Google AI)
4. Click "Save"
5. Select "Custom Model" from the AI Model menu

### Custom Languages

Add languages not included in the default list:

1. Open Settings → "Customization" tab → "Custom Languages" section
2. Enter language names, one per line (e.g., Esperanto, Sanskrit, Klingon)
3. Click "Save"
4. Your custom languages will appear in the Primary/Secondary language menus

### Display Settings

Configure popup window and translation display behavior:

1. Open Settings → "General" tab
2. **Auto-close on blur**: Enable this option to automatically close the popup window when it loses focus
3. **Enable streaming**: Enable this option to see translations appear progressively as the AI generates them (popup mode only)
4. **Popup font size**: Set the translation text size in the popup (10–24px)
5. **Reset Popup Size**: Restore the popup window to its default size
6. Click "Save"

**Display Modes:**
- **Notification & Copy**: Translation result appears as a system notification and is automatically copied to clipboard
- **Popup Window**: Translation result appears in a floating window with additional features:
  - Language direction shown in the header (e.g. "English → Japanese")
  - Real-time streaming (when enabled)
  - Back-translate button (⇄) to check the result against the source language
  - Copy button and keyboard shortcuts (Enter to copy, Escape to close)
  - Right-click context menu for copying selected text or all text
  - Resizable window — the size is remembered across closes
  - Auto-return focus to previous application when closed

## Usage

1. Select any text in any application
2. Press Ctrl+C (Windows/Linux) or Cmd+C (macOS) twice quickly
3. Depending on your display mode:
   - **Notification mode**: Translation appears as notification and is copied to clipboard
   - **Popup mode**: Translation appears in a floating window
4. In popup mode:
   - The header shows the detected language direction (e.g. "English → Japanese")
   - Click the back-translate button (⇄) to translate the result back to the source language and check its quality — click again to toggle between the two views (the header shows the reverse direction while viewing the back-translation)
   - Press Enter or click "Copy" to copy the translation and close
   - Press Escape or click "×" to close without copying
   - Right-click the text for copy options

### Smart Translation

The app intelligently determines the translation direction:
- If the source text matches your primary language → translates to secondary language
- If the source text is any other language → translates to primary language
- For mixed-language text → detects the language with highest word count ratio

### Menu Options

Access these options by clicking the system tray icon:
- **Primary/Secondary Language**: Set your translation language preferences (26+ built-in languages + custom)
- **Display Mode**: Choose between notification and popup window
- **AI Model**: Choose which AI model to use for translations (latest Claude, GPT, and Gemini models — auto-updated — or a custom model)
- **Settings**: Everything above and more — the tray menu is a shortcut to the most-used settings
- **Pause Translation**: Temporarily disable the translation feature
- **Stop Current Translation**: Cancel ongoing translation
- **Check for Updates**: Check for new versions with progress display
- **Quit**: Exit the application

### Keyboard Shortcuts

- **Ctrl/Cmd+C (twice)**: Trigger translation
- **Enter** (in popup): Copy and close
- **Escape** (in popup): Close without copying

### Auto-Update

Honyo automatically checks for updates on startup and every hour:
- **Update available**: Choose to Download, remind Later, or Skip the version
- **Downloading**: Progress displayed in menu (e.g., "Downloading Update (45%)...")
- **Downloaded**: Option to restart and install or install later
- **Skipped versions**: Won't be notified again until a new version is released
- **Manual check**: Use "Check for Updates" from the menu

### Environment Variables

You can also set API keys via environment variables:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`

Create a `.env` file in the project root:
```env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
```

## Development

### Prerequisites

- Node.js >= 23.6.0
- npm

### Setup

```bash
git clone https://github.com/rot1024/honyo.git
cd honyo
npm install
```

### Running in Development

```bash
npm start
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run the app in development mode (bundles preload/renderer first) |
| `npm run build:renderer` | Bundle only the preload and renderer scripts |
| `npm test` | Run tests with Vitest |
| `npm run test:ui` | Run tests with Vitest UI |
| `npm run typecheck` | Type check with TypeScript |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Fix lint errors |
| `npm run format` | Format with Prettier |
| `npm run dist` | Build and package for current platform |
| `npm run dist:mac` | Build and package for macOS |
| `npm run dist:win` | Build and package for Windows |
| `npm run dist:linux` | Build and package for Linux |

### Development environment variables

| Variable | Effect |
|----------|--------|
| `HONYO_USER_DATA_DIR` | Use a separate config/cache directory so a dev instance can run next to an installed Honyo |
| `HONYO_OPEN_SETTINGS=1` | Open the settings window on launch |
| `HONYO_THEME_PLATFORM=win32\|linux` | Preview another OS's settings theme (Fluent / Adwaita) |
| `HONYO_DEBUG_ECHO=text` | Run a no-network echo action through the popup/notification and history pipeline, then quit |
| `HONYO_POPUP_SCREENSHOT=path.png` | Show a sample translation popup, capture it to a PNG and quit |
| `HONYO_SETTINGS_SCREENSHOT=path.png` | Capture the settings window to a PNG and quit (with `HONYO_SETTINGS_SCREENSHOT_TAB`, `HONYO_SETTINGS_SCREENSHOT_SCRIPT` to run JS first, and `HONYO_THEME=light\|dark`) |

### Project Structure

```
src/
├── main.ts              # Entry point
├── models.ts            # AI model definitions
├── models-tier.ts       # Recommended/advanced model classification
├── actions/             # Action framework: what Honyo does to copied content (translate, …)
├── app/                 # App lifecycle, updater, accessibility
├── config/              # Configuration management
├── history/             # Local history of action results
├── ipc/                 # Typed IPC contracts shared by main, preload and renderer
├── keyboard/            # Keyboard event handling (uiohook-napi)
├── language/            # Language detection and constants
├── preload/             # contextBridge preload scripts (bundled to build/preload)
├── renderer/            # Browser-side code for windows (bundled to build/renderer)
├── translation/         # AI translation (Vercel AI SDK)
└── ui/                  # Tray, menu, popup, settings windows (main process side)

The settings window is built with [Xel](https://xel-toolkit.org/), a widget toolkit with
native-looking themes: Cupertino on macOS, Fluent on Windows, Adwaita on Linux, each
following the system light/dark mode. The renderer runs with context isolation and
talks to the main process only through the typed API in `src/ipc/settings.ts`. The popup
window uses the same preload/context-isolation setup via `src/ipc/popup.ts`.
```

### Tech Stack

- **Electron** - Desktop app framework
- **TypeScript** - Language
- **Vercel AI SDK** - AI provider integration (Anthropic, OpenAI, Google)
- **uiohook-napi** - Global keyboard hooks
- **electron-builder** - Packaging
- **Vitest** - Testing
- **ESLint + Prettier** - Linting and formatting

### Release

```bash
npm run release          # Auto version bump based on commits
npm run release:patch    # Patch release (0.0.x)
npm run release:minor    # Minor release (0.x.0)
npm run release:major    # Major release (x.0.0)
```

This updates version, generates CHANGELOG.md, and creates a git tag. Push the tag to trigger the GitHub Actions release workflow.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

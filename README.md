<div align="center">
  <img src="assets/icon.svg" width="128" height="128" alt="Honyo Icon">

  # Honyo - AI-Powered Translation Tool

  A desktop application that provides instant AI-powered translation with a simple double Ctrl/Cmd+C shortcut, similar to DeepL.

  ![Honyo screenshot](assets/screenshot.png)
</div>


## Features

- ⚡ **Instant Translation** - Select text and press Ctrl/Cmd+C twice, or a shortcut of your choice
- 🤖 **Your Choice of AI** - Claude, GPT, Gemini or Grok with your own API key; the model list stays up to date
- 💻 **Local Translation** - PLaMo 3 Translate runs on your computer: no API key, and your text never leaves the machine
- 🌍 **61 Languages** - Including Easy Japanese (やさしい日本語), plus any language you add
- 🔁 **Back-Translation** - Translate the result back to check it
- 💬 **Popup or Notification** - Read the result in a popup, or have it copied to the clipboard
- 🎨 **Custom Instructions** - Set the tone and terminology, or describe what you want and let the AI write them
- 👤 **Profiles** - Separate languages, models and instructions for work, personal use or each client

## Installation

Requires macOS 13 Ventura or later (Apple Silicon or Intel), Windows 10 or later (x64), or Linux (x64).

### macOS

With [Homebrew](https://brew.sh):

```bash
brew install --cask eukarya-inc/tap/honyo
```

Or download `Honyo-<version>-arm64.dmg` (Apple Silicon) or `Honyo-<version>.dmg` (Intel) from
[Releases](https://github.com/eukarya-inc/honyo/releases) and drag Honyo.app to Applications.

Honyo isn't signed yet, so before the first launch clear the quarantine flag:

```bash
xattr -cr /Applications/Honyo.app
```

On first launch, allow Honyo under System Settings → Privacy & Security → Accessibility; it needs
this to notice the double Cmd+C.

### Windows

Download and run `Honyo.Setup.<version>.exe` from [Releases](https://github.com/eukarya-inc/honyo/releases).

### Linux

Download `Honyo-<version>.AppImage` from [Releases](https://github.com/eukarya-inc/honyo/releases),
make it executable and run it.

Honyo updates itself: it checks for new versions at startup and every hour, and asks before
installing one.

## Getting Started

1. Choose how to translate, from the tray icon:
   - **A cloud model**: open **Settings… → API Keys** and enter a key for
     [Anthropic](https://platform.claude.com/), [OpenAI](https://platform.openai.com/api-keys),
     [Google AI](https://aistudio.google.com/app/apikey) or xAI.
   - **On your computer**: in **Local Models**, download PLaMo 3 Translate (see
     [Local Translation](#local-translation)).
2. Select text in any app and press Ctrl+C (Cmd+C on macOS) twice quickly.
3. The translation is copied to the clipboard and shown in a notification. To read it in a
   window instead, set **Display Mode** to **Popup Window** in the tray: there **Enter** copies
   it and closes the popup, **Escape** closes it, and ⇄ shows a back-translation to check the
   result.

Honyo translates into your **primary** language, and text already in your primary language into
your **secondary** one. The primary language starts as your system language and the secondary as
English (Japanese if your system is in English); change them from the tray.

## Settings

The tray menu has the everyday switches: profile, languages, model, display mode. **Settings…**
has everything else.

### Languages

61 languages are built in, and you can add others under Settings → Customization → Custom
Languages.

<details>
<summary>Built-in languages</summary>

English, Japanese, Japanese (Easy), Chinese (Simplified), Chinese (Traditional), Korean, Spanish,
French, German, Italian, Portuguese, Russian, Arabic, Hindi, Thai, Vietnamese, Indonesian, Malay,
Filipino, Dutch, Polish, Turkish, Ukrainian, Swedish, Danish, Norwegian, Finnish, Azerbaijani,
Belarusian, Bulgarian, Bengali, Catalan, Cebuano, Estonian, Basque, Persian, Gujarati, Hebrew,
Croatian, Hungarian, Armenian, Javanese, Georgian, Kazakh, Khmer, Lithuanian, Latvian, Malayalam,
Marathi, Burmese, Nepali, Punjabi, Sinhala, Slovak, Slovenian, Serbian, Swahili, Tamil, Telugu,
Urdu, Uzbek

</details>

**Japanese (Easy)** is やさしい日本語: short sentences and everyday words for readers still
learning Japanese. Pair it with Japanese to rewrite ordinary Japanese into Easy Japanese, or with
another language to translate into it.

### AI Models

Pick a model from **AI Model** in the tray. **Default** follows Honyo's recommendation, a fast and
inexpensive model that suits translation; larger models are under **Advanced Models**. The list
updates itself as providers release new models. To use a model that isn't listed, enter its name
under Settings → Translation → Custom Model.

### Local Translation

[PLaMo 3 Translate](https://huggingface.co/pfnet/plamo-3-translate-2b-GGUF) by Preferred Networks
runs on your computer: no API key is needed, and your text never leaves the machine.

- Download it from **Local Models** in the tray: **2B** (about 1.8 GB) or the lighter, faster
  **0.8B** (about 0.6 GB). It then appears in **AI Model**.
- It is free for personal and non-commercial use under the
  [PLaMo Community License](https://plamo.preferredai.jp/info/plamo-community-license-en);
  commercial use requires registering with PFN.
- The **Local Models** menu shows whether the model is loaded, and lets you delete a model or
  open the folder holding it. A loaded model takes about its file size in memory and is unloaded
  after 30 minutes without use.
- It covers 53 of Honyo's languages (not Portuguese, Turkish, Ukrainian, Swedish, Danish,
  Norwegian or Finnish), and doesn't follow custom instructions.

### Custom Instructions

Under Settings → Customization, add instructions sent with every translation, such as "Use formal
language" or "Keep product names in English". **Generate…** writes them from a short description.

### Profiles

A profile holds languages, model, instructions and API keys, so you can keep separate setups for
work, personal use or each client. Switch from **Profile** in the tray or the selector in
Settings, where you can also create, duplicate, rename and delete profiles. Each profile can have
its own global shortcut.

### Display and Notifications

- **Popup** shows the result in a floating window you can resize; **Notification & Copy** copies
  the result and shows a notification.
- If system notifications can't be shown (as with the unsigned app on macOS), Honyo shows its
  own. Settings → General → Notifications chooses which.
- **Play a sound** chimes when a translation is ready.
- Instead of the double Ctrl/Cmd+C, you can set your own shortcut under Settings → General.
- Recent results are under **History** in the tray; click one to copy it. History can be turned
  off or cleared in Settings.

### For Organizations

API keys are stored encrypted with the OS credential store. Each provider can be pointed at an LLM
gateway or proxy (Settings → API Keys → Endpoints), and keys and endpoints can be deployed and
locked through MDM (macOS configuration profiles, Windows policies, or a `managed.json` file). See
[docs/mdm](docs/mdm/README.md).

## Development

### Prerequisites

- Node.js >= 23.6.0
- npm

### Setup

```bash
git clone https://github.com/eukarya-inc/honyo.git
cd honyo
npm install
```

### Running in Development

```bash
npm start
```

API keys can also come from `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` and
`XAI_API_KEY`, for example in a `.env` file at the project root. They are used when a profile has
no key and are never saved.

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
| `HONYO_MANAGED_JSON=path` | Read managed (MDM) settings from this file instead of the system location |
| `HONYO_DEBUG_ECHO=text` | Run a no-network echo action through the popup/notification and history pipeline, then quit |
| `HONYO_POPUP_SCREENSHOT=path.png` | Show a sample translation popup, capture it to a PNG and quit |
| `HONYO_DEBUG_TRANSLATE=text` | Run one translation through the full pipeline (after `HONYO_DEBUG_TRANSLATE_DELAY` ms); with `HONYO_DEBUG_TRANSLATE_SHOT=prefix`, capture the popup and toast to `prefix-*.png` and quit |
| `HONYO_DEBUG_MENU=1` | Log the tray menu each time it is rebuilt |
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
├── local/               # Local translation: model/runtime download, llama-server, PFML3 prompts
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
- **Vercel AI SDK** - AI provider integration (Anthropic, OpenAI, Google, xAI)
- **llama.cpp** + **PLaMo 3 Translate** - Local translation (downloaded on demand)
- **ELD** - n-gram language detection for Latin-script languages
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

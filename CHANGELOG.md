# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.7.0](https://github.com/rot1024/honyo/compare/v0.6.0...v0.7.0) (2026-11-13)


### Features

* "Built with PLaMo" credit and license link for local translation ([af58352](https://github.com/rot1024/honyo/commit/af583529abf8dd3960fdaeee2332992e3626011b))
* action framework and Clipy-style result history ([8481314](https://github.com/rot1024/honyo/commit/8481314f17ae09418099b3ee98542dfa45071450))
* add 34 languages supported by PLaMo 3 Translate ([ccb6e1e](https://github.com/rot1024/honyo/commit/ccb6e1eeb69590f1d085da841c1d4f81858ade6e))
* add a Default entry to the AI Model menu ([1cf0061](https://github.com/rot1024/honyo/commit/1cf0061f7b3f918b870cf8fc51d255a11a7cbd7c))
* customizable translate shortcut and per-profile shortcuts ([3432d20](https://github.com/rot1024/honyo/commit/3432d20640336ebb9a3acee6e9963ee451df36c6))
* default to Haiku and fold advanced models into a submenu ([ffad8ae](https://github.com/rot1024/honyo/commit/ffad8ae2d29f35cbff34ae93b9903c775b0cd2dc))
* derive the Default model from the fetched catalog ([3716da8](https://github.com/rot1024/honyo/commit/3716da88b50249b3e514fe4b9a9f535b8f0c45a1))
* detect the source language from prose, not code or stray words ([e9e2904](https://github.com/rot1024/honyo/commit/e9e2904fddbde46b5b2b222f3e2ad4b15c0c7da4))
* edit languages, model and display mode in the settings window ([bfea74c](https://github.com/rot1024/honyo/commit/bfea74ce37d4acab8e1305564e9f002efe8e048b))
* Honyo's own notifications, with a setting to choose ([8788a8d](https://github.com/rot1024/honyo/commit/8788a8daf26622e48421d231bc222a50b6e0b611))
* Japanese (Easy) as a language ([1b7a714](https://github.com/rot1024/honyo/commit/1b7a71458b0518efd84a2638bcb28521e249ba53))
* list downloaded local models in the settings window ([acbef2e](https://github.com/rot1024/honyo/commit/acbef2eb8cddddc64c1ca63a15e4f9ff38aa8e88))
* Local Models tray menu with status, folder and delete ([3b45497](https://github.com/rot1024/honyo/commit/3b454972eb084f60db2f8059f94365372b17468b))
* local translation with PLaMo 3 Translate, and show provider errors ([56ee783](https://github.com/rot1024/honyo/commit/56ee783019c984260e4493d7940ba451ba8c392b))
* optional sound when a translation finishes ([82f62a9](https://github.com/rot1024/honyo/commit/82f62a949ebbdfb0ee01a84628fd1d113c053443))
* profiles, encrypted API keys, and per-provider base URLs ([23198e9](https://github.com/rot1024/honyo/commit/23198e98c97a4eeb086c36585eef0c955739ca68))
* rebuild the settings window with Xel native-look widgets ([9e314c0](https://github.com/rot1024/honyo/commit/9e314c0a8ba75783e8bd0e0e8e6992ad304cb8e7))
* say a local model is loading in notification mode ([0ffe85d](https://github.com/rot1024/honyo/commit/0ffe85d3b0223b5bcbb5df1e2ebd58c78b0b4651))
* xAI provider and MDM-managed provider settings ([6c4e198](https://github.com/rot1024/honyo/commit/6c4e198ea01ab566be33b4bfcf8f8381550521d8))


### Bug Fixes

* centre the settings tabs in the toolbar ([e8b3a37](https://github.com/rot1024/honyo/commit/e8b3a37dd7fadabaee5c36282abf194c5321d830))
* detect source language by sentence structure and script, not Latin-letter names ([c51f98b](https://github.com/rot1024/honyo/commit/c51f98bede8fe1ebd6189e764295a4abfd459740))
* do not persist environment-variable API keys during config migration ([c3385b8](https://github.com/rot1024/honyo/commit/c3385b8e7ff82e65f44029685a773da92091812e))
* drop OpenAI's Daybreak models from the model list ([1474388](https://github.com/rot1024/honyo/commit/14743880335e6fe823095f8197b321107b44f203))
* **local:** don't leave llama-server key files behind ([2296323](https://github.com/rot1024/honyo/commit/2296323485a4c18ce1b01b19eacce8f0795b637f))
* never leave llama-server running after Honyo quits ([97f539b](https://github.com/rot1024/honyo/commit/97f539b320d1626f8482ffbf9d0408bdb9435857))
* point auto-updater at eukarya-inc repository ([3dcb2c4](https://github.com/rot1024/honyo/commit/3dcb2c4657a6d47d5c8038756c169c16f4ea9783))
* **popup:** show a result that arrives in one piece, copy what is shown ([511ac9c](https://github.com/rot1024/honyo/commit/511ac9c0ff2384009f96e48632fd955beff66ed9))
* **settings:** ask about unsaved changes on tray Quit; show when themed ([0331de7](https://github.com/rot1024/honyo/commit/0331de7ee2fa9200e3f4622b65d4f0c6d1b69b5b))
* **settings:** ask before closing with unsaved changes; no white flash ([b3f725f](https://github.com/rot1024/honyo/commit/b3f725f5ba45bc746f3464557a2711c1e0202d3b))
* **settings:** no white flash when the window closes ([a5ef871](https://github.com/rot1024/honyo/commit/a5ef8713d6264a296c9ddb859daee9b0936333bb))
* **settings:** write custom prompts with Default when a local model is selected ([f448edf](https://github.com/rot1024/honyo/commit/f448edf9b6b5356d91ca3aa4a3efd17cd8193e5b))
* stop a llama-server that is still loading its model ([ce72bb5](https://github.com/rot1024/honyo/commit/ce72bb5871a4e85441f84736e1cc43585993d7c7))
* **toast:** show a new notice in a toast that is still open ([53d0b04](https://github.com/rot1024/honyo/commit/53d0b0432849954a37f13e96e9f2ba57f6297827))


### Code Refactoring

* move API key encryption to the async safeStorage API ([08020a8](https://github.com/rot1024/honyo/commit/08020a8adebe3882bf4758ce0f160ef3bfb8175f))
* run the popup window with context isolation and a typed preload ([04686ed](https://github.com/rot1024/honyo/commit/04686eda9f23b6f90ca931dcc30a9c03bce13eec))


### Documentation

* MDM deployment guide with macOS profile templates ([34e1067](https://github.com/rot1024/honyo/commit/34e10677818f997b7c5e4bfd50a1123fd6fc19fe))
* system requirements, local translation, and the new dev hooks ([5f71650](https://github.com/rot1024/honyo/commit/5f71650a724f85c5a549aa4ae3341c667a69aba8))
* trim README features to what matters to users ([0e22106](https://github.com/rot1024/honyo/commit/0e22106068a12d4bcdd62c2be3d09e9108812852))
* update provider console links (Anthropic console moved to platform.claude.com) ([52de689](https://github.com/rot1024/honyo/commit/52de6891eb3e137430e34428947c7e9ca09c9962))

## [0.6.0](https://github.com/rot1024/honyo/compare/v0.5.0...v0.6.0) (2026-07-23)


### Features

* add AI-assisted custom prompt generation in settings ([ff2b1d4](https://github.com/rot1024/honyo/commit/ff2b1d426b227d2fba25da6a5dca47e67f7357b8))
* add auto-start option for launching Honyo at login ([#4](https://github.com/rot1024/honyo/issues/4)) ([6892685](https://github.com/rot1024/honyo/commit/6892685e8cd84686ef4c5eca5cbb73da3799980f))
* add language direction display and refine popup UI ([a61abf7](https://github.com/rot1024/honyo/commit/a61abf7256a36b8a06b3054297177a0e153450c7))
* enable autoCloseOnBlur and streaming by default ([98f223d](https://github.com/rot1024/honyo/commit/98f223d4663885aec41ff19c2996bad7efc91513))
* refresh model catalog with auto-update, harden prompt, improve popup ([ef0554d](https://github.com/rot1024/honyo/commit/ef0554d2ae939ef9e7a32179ec72dea0138b4e00))
* show language direction in popup header and simplify captions ([5ec1ac5](https://github.com/rot1024/honyo/commit/5ec1ac503cc29d7011f759761350df54691a24f9))


### Code Refactoring

* consolidate customization tabs and rename Anthropic to Claude ([fa3ceb2](https://github.com/rot1024/honyo/commit/fa3ceb2a0c844e44d6b7237ac55e530e570cabd4))


### Documentation

* add development documentation to README ([#3](https://github.com/rot1024/honyo/issues/3)) ([1e49040](https://github.com/rot1024/honyo/commit/1e490408191b9fd3e28995e6a571c889d74c23cb))
* update README with auto-updating models, back-translation, and popup features ([d1d0a2d](https://github.com/rot1024/honyo/commit/d1d0a2daf79ac752f6a74f3a9b5c9f41460fbf87))

## [0.5.0](https://github.com/rot1024/honyo/compare/v0.4.5...v0.5.0) (2025-11-28)


### Features

* add Setup-Honyo.command for macOS quarantine removal ([410c2a2](https://github.com/rot1024/honyo/commit/410c2a2ef27489016aa98f0c8f1c0dfcd7ec2a35))
* update AI model list with latest models ([27e90da](https://github.com/rot1024/honyo/commit/27e90da3648df872ec2f008fe1488f171f157e94))


### Bug Fixes

* remove redundant type cast in config initialization ([a43e0e9](https://github.com/rot1024/honyo/commit/a43e0e9bddd56f53903e33f49715affda1864315))


### Code Refactoring

* migrate scripts to TypeScript and use native Node.js type stripping ([7deaade](https://github.com/rot1024/honyo/commit/7deaadec770cc976fd7d0d2886d566bd486623f8))

### [0.4.5](https://github.com/rot1024/honyo/compare/v0.4.4...v0.4.5) (2025-10-09)


### Features

* add separator for aach model provider in menu ([17af341](https://github.com/rot1024/honyo/commit/17af34102f2ee635e3edabe85a29b6b4a2a166b2))


### Bug Fixes

* clean up system prompt ([a7b628c](https://github.com/rot1024/honyo/commit/a7b628cf8389cdf8d2594f0e7eb201282ab9fee1))
* close popup even in streaming on press enter key ([8078d16](https://github.com/rot1024/honyo/commit/8078d16d191a90ba47c7068d5c4cf422ecda88a7))
* optimisze system prompt to support short text translation ([73770fa](https://github.com/rot1024/honyo/commit/73770fa8b3bd02f2de1db19b239459d7d649282c))

### [0.4.4](https://github.com/rot1024/honyo/compare/v0.4.3...v0.4.4) (2025-10-03)


### Bug Fixes

* show changelog correctly on update ([b2cd37d](https://github.com/rot1024/honyo/commit/b2cd37da9f7e7dbd5db796cc461581d66638fbb5))

### [0.4.3](https://github.com/rot1024/honyo/compare/v0.4.2...v0.4.3) (2025-10-03)

### [0.4.2](https://github.com/rot1024/honyo/compare/v0.4.1...v0.4.2) (2025-10-03)


### Bug Fixes

* open releases page on donwload error ([8734110](https://github.com/rot1024/honyo/commit/8734110a48e21f32364fb24552e345309b7f1556))

## [0.4.0](https://github.com/rot1024/honyo/compare/v0.3.4...v0.4.0) (2025-08-04)


### Features

* add display settings with auto-close option for translation popup ([#1](https://github.com/rot1024/honyo/issues/1)) ([c26e78f](https://github.com/rot1024/honyo/commit/c26e78f8ace5a6ab5ba1675d8098e6b4b30f5001))


### Bug Fixes

* correct formatting of font-family in settings.html ([#2](https://github.com/rot1024/honyo/issues/2)) ([bd8d68a](https://github.com/rot1024/honyo/commit/bd8d68a16cfb494f02ffa56c1d2f73cac849ef42))
* update tray icon ([5037614](https://github.com/rot1024/honyo/commit/50376149f60a8c14a1bce883b77d9458fe65475f))

### [0.3.4](https://github.com/rot1024/honyo/compare/v0.3.3...v0.3.4) (2025-08-04)


### Bug Fixes

* app closes when all windows closed in windows ([661838e](https://github.com/rot1024/honyo/commit/661838e2a02d8f80f4906154423b55cbe8e7a411))


### Documentation

* add installation to readme ([e4b0de0](https://github.com/rot1024/honyo/commit/e4b0de0de2e76d1203109cf95971b0f634b73973))
* update readme ([71fa90b](https://github.com/rot1024/honyo/commit/71fa90ba44b5884954e70a6c6703188cda9f8ef3))

### [0.3.3](https://github.com/rot1024/honyo/compare/v0.3.2...v0.3.3) (2025-08-01)

### [0.3.2](https://github.com/rot1024/honyo/compare/v0.3.1...v0.3.2) (2025-08-01)

### [0.3.1](https://github.com/rot1024/honyo/compare/v0.3.0...v0.3.1) (2025-08-01)


### Bug Fixes

* mac binary did not work ([0a4b015](https://github.com/rot1024/honyo/commit/0a4b01504b5695e8aa349f0e661df91e6ab21f93))

## [0.3.0](https://github.com/rot1024/honyo/compare/v0.2.0...v0.3.0) (2025-08-01)


### Features

* command to stop translation ([fef8a44](https://github.com/rot1024/honyo/commit/fef8a441113dbf232d8774800e14ee29a1f1a401))


### Performance Improvements

* remove lang detector and improve performance ([768006c](https://github.com/rot1024/honyo/commit/768006c89ca7f6292fe0d56bf9582c835ce48f59))

# [0.3.0](https://github.com/rot1024/honyo/compare/v0.2.0...v0.3.0) (2025-08-01)


### Features

* command to stop translation ([fef8a44](https://github.com/rot1024/honyo/commit/fef8a441113dbf232d8774800e14ee29a1f1a401))


### Performance Improvements

* remove lang detector and improve performance ([768006c](https://github.com/rot1024/honyo/commit/768006c89ca7f6292fe0d56bf9582c835ce48f59))



# [0.2.0](https://github.com/rot1024/honyo/compare/v0.1.0...v0.2.0) (2025-08-01)


### Features

* add app icon ([afb55af](https://github.com/rot1024/honyo/commit/afb55af742a1c7ab11184ef73781871e7bfc7fed))
* custom model and custom lang ([4540c4a](https://github.com/rot1024/honyo/commit/4540c4a9c4444c7a992932cccc079aeb951288ce))



# [0.1.0](https://github.com/rot1024/honyo/compare/381dd6ef1b5cfa73c66722f0bd7e3ebfdf554518...v0.1.0) (2025-08-01)


### Bug Fixes

* menu text ([955415e](https://github.com/rot1024/honyo/commit/955415eb4aa21552fd726198335955fa0caea112))


### Features

* check accessibility setting for mac ([d22cdad](https://github.com/rot1024/honyo/commit/d22cdada58c31c8a32de8878ad5487b84d6cf7e8))
* custom prompt settings ([381dd6e](https://github.com/rot1024/honyo/commit/381dd6ef1b5cfa73c66722f0bd7e3ebfdf554518))
* enable auto updater ([b3a2129](https://github.com/rot1024/honyo/commit/b3a21297d8960224afeb5043586f0569d4b0f3a2))
* popup mode ([a267ad2](https://github.com/rot1024/honyo/commit/a267ad259677a0da7cbe87b94796591261b269f6))

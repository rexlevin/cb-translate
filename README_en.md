# 灵译 LingYi · cb-translate

Lightweight desktop translation tool built on the [Canbox platform](https://rexlevin.github.io/canbox-pages/). Clean, focused UI for everyday translation — powered by the [Baidu Translate Open Platform](https://fanyi-api.baidu.com/) (bring your own free API key).

[中文文档](./README.md)

## Features

- ⚡ **Instant translation** — Type or paste text, press `Ctrl+Enter`, done
- 🌍 **19 target languages** — Simplified/Traditional Chinese, English, Japanese, Korean, French, German, Spanish, Russian, Portuguese, Italian, Arabic, Thai, Vietnamese, Indonesian, Dutch, Polish, Turkish, Hindi and more
- 🔎 **Auto language detection** — Detect the source language automatically; the recognized language is shown above the result
- 🔄 **Swap direction** — One-click swap between source and target languages
- 📋 **One-click copy** — Copy the full translation to the clipboard instantly
- 🕘 **Translation history** — Every successful translation is saved locally; click an entry to restore the source text, language pair and result
- ⚙️ **Customizable** — Set your default target language and history limit (10 – 1000 records, 200 by default)
- 🔒 **Key security** — Your Baidu APP ID / secret never leaves your machine unencrypted: credentials are sealed with the OS keychain (DPAPI / Keychain / libsecret) and requests are signed in the main process
- 📐 **UI scaling & persistence** — Zoom the interface with `Ctrl+wheel` / `Ctrl+=` / `Ctrl+-` / `Ctrl+0`; window size and zoom level are remembered across restarts

## Getting started

### 1. Install the app

Install and launch cb-translate through the **Canbox manager** (add the repository URL `https://github.com/rexlevin/cb-translate`, or install from the app catalog).

### 2. Get a free Baidu Translate API key

LingYi calls the Baidu Translate Open Platform using **your own** credentials (no built-in key, your account, your quota):

1. Open [fanyi-api.baidu.com](https://fanyi-api.baidu.com/) and register / sign in
2. Create an application (通用文本翻译 / General Text Translation) and take note of the **APP ID** and **密钥 / Secret**
3. The free Standard plan provides a monthly character quota — enough for everyday use

> 💡 Tip: For tighter security you can enable an **IP whitelist** for the app. If the whitelist is set, requests must come from an allowed IP (error `58000` otherwise).

### 3. Configure in Settings

1. Open LingYi and click **设置 / Settings** in the top-right corner
2. Under **百度翻译**, enter your APP ID and Secret, then click **保存 / Save**
3. Optionally pick your **默认目标语言** and adjust the **历史上限**

That's it — you can start translating.

## Usage guide

### Translate text

1. Enter or paste text (multi-line supported, up to **6000 characters**; the counter sits at the bottom-left of the input box)
2. Choose the **source language** (default: 自动检测 / auto-detect) and the **target language**
3. Click **翻译 / Translate**, or press **`Ctrl+Enter`**

### Read the result

- The engine name (百度翻译) is always shown
- When auto-detection is enabled, the actually detected language appears above the result as `识别为…`
- Click **复制 / Copy** to copy the entire translation to the clipboard
- Long texts are split into paragraphs, matching the layout of the original

### Translation history

Open the **历史 / History** drawer (top-right):

- Every successful translation is stored locally, newest first
- Click an entry → source text, language pair and result are restored for editing or re-use
- Delete individual entries with the trash icon, or **清空 / Clear** everything (with confirmation)
- When the history exceeds the configured limit, the oldest records are trimmed automatically

## Settings overview

| Setting | Description | Default |
|---|---|---|
| 百度翻译 APP ID / 密钥 | Your Baidu Open Platform credentials (encrypted at rest) | — |
| 默认目标语言 | Target language used when the app starts | 中文(简体) |
| 历史上限 | Maximum number of history records (10 – 1000) | 200 |

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` | Translate |
| `Ctrl+1` | Focus the input box |
| `Ctrl+wheel` / `Ctrl+=` / `Ctrl+-` | Zoom the interface in / out |
| `Ctrl+0` | Reset zoom to 100% |

## Security & privacy

- **Credentials** — APP ID / Secret are encrypted with the operating system's secure storage (Windows DPAPI, macOS Keychain, Linux libsecret) before they touch disk; the renderer never sees the plaintext secret.
- **Requests** — Translation requests are signed in the main process and sent directly to Baidu's API; no third-party server is involved.
- **Data** — Source texts are transmitted to Baidu for translation (as required by the service). Translation history is stored **only on your machine**.
- If your OS provides no secure storage backend, LingYi falls back to plaintext local storage and clearly warns you inside Settings.

## FAQ

**Q: "请先在设置中配置百度翻译 APP ID 与密钥"**
You have not configured your key yet. Complete the steps in [Getting started](#getting-started).

**Q: 52003 / 未授权用户**
The APP ID is incorrect or the application is not approved yet — check it on the Baidu Open Platform console.

**Q: 54001 / 签名错误**
The Secret does not match the APP ID. Re-enter both credentials in Settings.

**Q: 54004 / 账户余额不足或免费额度已用完**
The free monthly quota is exhausted or the account balance is empty. Wait for the quota reset or top up.

**Q: 58000 / 客户端 IP 不在白名单内**
An IP whitelist is enabled for the Baidu app but your current IP is not listed. Add your IP to the whitelist or disable it.

**Q: 网络请求失败**
Check your internet connection and retry. A single request times out after 15 seconds.

**Q: 译文语言方向不支持**
Some language pairs are not supported by Baidu for the chosen direction — pick a supported source/target language.

## License

[Apache-2.0](./LICENSE)

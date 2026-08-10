# Gloss

Unpacked Chrome extension that personalizes any website with a floating orb. It screenshots the page, sends that plus your prompt to the [xAI Grok API](https://docs.x.ai/), and injects CSS (streamed) and optional JavaScript. Keep prompting to iterate. Changes stick per site until you reset.

**Not on the Chrome Web Store.** Chrome forbids executing model-generated JavaScript, so this is load-unpacked only for now.

## Install

1. Clone this repo.
2. `bun install`
3. `bun run build`
4. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose `.output/chrome-mv3`.
5. On the Gloss card, turn on **Allow User Scripts** (needed to run generated JS on strict sites like x.com).
6. Open the Gloss options page and paste an xAI API key from [console.x.ai](https://console.x.ai/). The default model is `grok-4.5`; switch to `grok-4.3` if that key cannot use 4.5.

## Use

1. Open any normal website.
2. Click the **Gloss** orb, or press ⌘⇧Y / Ctrl+Shift+Y.
3. Prompt like `make this more zen` or `calm reading mode, hide the noise`.
4. Keep going. Each run captures a fresh screenshot so the model can iterate.

**Reset** clears the restyle for that origin. JavaScript changes that did not register a cleanup hook may need a page refresh.

## Develop

```bash
bun run playground   # UI stories at http://localhost:6006
bun run build        # production zip in .output/chrome-mv3
bun run compile      # typecheck
```

To reload an already-running Chrome that was started with `--remote-debugging-port=9333 --enable-unsafe-extension-debugging`:

```bash
bun scripts/load-unpacked.mjs
```

## What leaves your machine

Every restyle sends a **screenshot of the visible tab** plus a small DOM sketch (URL, title, landmarks, visible labels) to `api.x.ai`. Your API key is stored in `chrome.storage.local` and is only sent as a Bearer token to xAI.

Optional **JavaScript** from the model runs in the page. Treat prompts on logged-in or sensitive sites accordingly.

## License

MIT

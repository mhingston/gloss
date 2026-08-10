import { glossWithGrok } from '@/lib/grok';
import { getSettings } from '@/lib/storage';
import { isUserScriptsAvailable } from '@/lib/userScripts';
import type {
  ExtensionMessage,
  HasSettingsResponse,
  GlossResponse,
} from '@/lib/types';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      void browser.runtime.openOptionsPage();
    }
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'toggle-gloss') return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id == null) return;
    try {
      await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' } satisfies ExtensionMessage);
    } catch {
      // No content script on this page (chrome://, Web Store, etc.)
    }
  });

  browser.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
    if (message.type === 'OPEN_OPTIONS') {
      return openOptionsPage();
    }

    if (message.type === 'HAS_SETTINGS') {
      return getSettings().then(
        (settings): HasSettingsResponse => ({
          hasApiKey: Boolean(settings.apiKey),
          model: settings.model,
        }),
      );
    }

    if (message.type === 'GLOSS') {
      return handleGloss(message, sender);
    }

    if (message.type === 'RUN_PAGE_JS') {
      return runPageJs(sender.tab?.id, message.source);
    }

    if (message.type === 'SET_ICON_THEME') {
      return setIconTheme(sender.tab?.id, message.dark);
    }
  });
});

async function openOptionsPage() {
  const url = browser.runtime.getURL('/options.html');
  try {
    await browser.runtime.openOptionsPage();
  } catch {
    await browser.tabs.create({ url, active: true });
    return;
  }

  const tabs = await browser.tabs.query({ url });
  if (tabs.length === 0) {
    await browser.tabs.create({ url, active: true });
  } else if (tabs[0]?.id != null) {
    await browser.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId != null) {
      await browser.windows.update(tabs[0].windowId, { focused: true });
    }
  }
}

async function handleGloss(
  message: Extract<ExtensionMessage, { type: 'GLOSS' }>,
  sender: Browser.runtime.MessageSender,
): Promise<GlossResponse> {
  const settings = await getSettings();
  if (!settings.apiKey) {
    return {
      ok: false,
      needsApiKey: true,
      error: 'Add your xAI API key in settings.',
    };
  }

  const windowId = sender.tab?.windowId;
  if (windowId == null) {
    return { ok: false, error: 'Could not find the tab to screenshot.' };
  }

  try {
    const screenshotDataUrl = await browser.tabs.captureVisibleTab(windowId, {
      format: 'jpeg',
      quality: 72,
    });

    const tabId = sender.tab?.id;
    if (tabId != null) {
      try {
        await browser.tabs.sendMessage(tabId, { type: 'GLOSS_STARTED' });
      } catch {
        // Tab may have navigated.
      }
    }

    const allowJs = await isUserScriptsAvailable();
    const result = await glossWithGrok({
      apiKey: settings.apiKey,
      model: settings.model,
      prompt: message.prompt,
      screenshotDataUrl,
      pageContext: message.pageContext,
      previousCss: message.previousCss,
      previousJs: allowJs ? message.previousJs : '',
      promptHistory: message.promptHistory,
      allowJs,
      onProgress(update) {
        if (tabId == null) return;
        void browser.tabs.sendMessage(tabId, {
          type: 'GLOSS_PROGRESS',
          css: update.css,
          text: update.text,
        });
      },
    });

    return { ok: true, css: result.css, js: result.js, summary: result.summary };
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    };
  }
}

const USER_SCRIPT_WORLD = 'gloss';

async function setIconTheme(tabId: number | undefined, dark: boolean) {
  const folder = dark ? 'dark' : 'light';
  const path = {
    16: `icon/${folder}/16.png`,
    32: `icon/${folder}/32.png`,
    48: `icon/${folder}/48.png`,
    128: `icon/${folder}/128.png`,
  };
  if (tabId == null) {
    await browser.action.setIcon({ path });
    return;
  }
  await browser.action.setIcon({ tabId, path });
}



function wrapPageJs(source: string): string {
  return `(function () {
  try { globalThis.__glossCleanup?.(); } catch (error) {}
  globalThis.__glossCleanup = undefined;
  ${source}
})();`;
}

async function runPageJs(
  tabId: number | undefined,
  source: string,
): Promise<{ ok: boolean; error?: string }> {
  if (tabId == null) {
    return { ok: false, error: 'Could not find the tab to inject JavaScript.' };
  }

  const api = browser.userScripts;
  if (!api?.execute) {
    if (!source.trim()) return { ok: true };
    return {
      ok: false,
      error: 'Open Gloss Details on chrome://extensions and turn on Allow User Scripts.',
    };
  }

  try {
    await api.configureWorld?.({
      worldId: USER_SCRIPT_WORLD,
      messaging: false,
    });
  } catch {
    // World may already be configured.
  }

  try {
    await api.execute({
      target: { tabId },
      injectImmediately: true,
      world: 'USER_SCRIPT',
      worldId: USER_SCRIPT_WORLD,
      js: [{ code: wrapPageJs(source) }],
    });
    return { ok: true };
  } catch (error) {
    const message = toErrorMessage(error);
    if (/user script|UserScripts|developer mode|not allowed|denied/i.test(message)) {
      return {
        ok: false,
        error: 'Turn on Allow User Scripts for Gloss in chrome://extensions.',
      };
    }
    return { ok: false, error: message };
  }
}

function toErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) return message;
  }
  return 'Gloss failed.';
}

import { useEffect, useState } from 'react';
import { GlossWidget } from '@/components/GlossWidget';
import { useWidgetDock } from '@/hooks/useWidgetDock';
import { applyPageCss, clearPageCss } from '@/lib/css';
import { applyPageJs, clearPageJs } from '@/lib/pageJs';
import { capturePageContext } from '@/lib/snapshot';
import { clearSiteState, getSiteState, saveSiteState } from '@/lib/storage';
import type {
  ExtensionMessage,
  HasSettingsResponse,
  GlossResponse,
  SitePrompt,
} from '@/lib/types';

function toErrorMessage(err: unknown): string {
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message?: unknown }).message ?? '').trim();
    if (message) return message;
  }
  return 'Gloss failed.';
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function waitFrames(count: number) {
  return new Promise<void>((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(left - 1));
    };
    step(count);
  });
}

export function GlossPanel() {
  const [open, setOpen] = useState(false);
  const [hiddenForCapture, setHiddenForCapture] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [css, setCss] = useState('');
  const [previousCss, setPreviousCss] = useState('');
  const [js, setJs] = useState('');
  const [previousJs, setPreviousJs] = useState('');
  const [prompts, setPrompts] = useState<SitePrompt[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [streamText, setStreamText] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const { widgetRef, dragging, consumeClickIfDragged, dock } = useWidgetDock(open, () => {
    setOpen(true);
  });

  const origin = location.origin;

  useEffect(() => {
    void (async () => {
      const state = await getSiteState(origin);
      setCss(state.css);
      setPreviousCss(state.previousCss);
      setJs(state.js);
      setPreviousJs(state.previousJs);
      setPrompts(state.prompts);
      applyPageCss(state.css);
      if (state.js) {
        try {
          await applyPageJs(state.js);
        } catch {
          // Page may block injection until the next gloss.
        }
      }

      const settings = (await browser.runtime.sendMessage({
        type: 'HAS_SETTINGS',
      } satisfies ExtensionMessage)) as HasSettingsResponse;
      setHasApiKey(settings.hasApiKey);
    })();

    const onStorage: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== 'local' || !changes.settings) return;
      const next = changes.settings.newValue as { apiKey?: string } | undefined;
      setHasApiKey(Boolean(next?.apiKey?.trim()));
    };
    browser.storage.onChanged.addListener(onStorage);
    return () => browser.storage.onChanged.removeListener(onStorage);
  }, [origin]);

  useEffect(() => {
    const onMessage = (message: ExtensionMessage) => {
      if (message.type === 'TOGGLE_PANEL') {
        setOpen((value) => !value);
        setError('');
      }
      if (message.type === 'GLOSS_STARTED') {
        setHiddenForCapture(false);
      }
      if (message.type === 'GLOSS_PROGRESS') {
        if (message.css.length >= 8) {
          applyPageCss(message.css);
          setCss(message.css);
        }
        setStreamText(message.text);
      }
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, []);

  useEffect(() => {
    const root = document.getElementById('gloss-root');
    const host = (root?.getRootNode() as ShadowRoot | undefined)?.host as HTMLElement | undefined;
    if (!host) return;
    host.style.visibility = hiddenForCapture ? 'hidden' : '';
  }, [hiddenForCapture]);

  useEffect(() => {
    if (!open) setLogOpen(false);
  }, [open]);

  async function persist(next: {
    css: string;
    previousCss: string;
    js: string;
    previousJs: string;
    prompts: SitePrompt[];
  }) {
    setCss(next.css);
    setPreviousCss(next.previousCss);
    setJs(next.js);
    setPreviousJs(next.previousJs);
    setPrompts(next.prompts);
    await saveSiteState(origin, next);
  }

  async function gloss(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !hasApiKey) return;

    const startingCss = css;
    const startingJs = js;
    setBusy(true);
    setError('');
    setStreamText('');
    setHiddenForCapture(true);

    try {
      await waitFrames(3);
      const pageContext = capturePageContext();

      const response = (await browser.runtime.sendMessage({
        type: 'GLOSS',
        prompt: trimmed,
        pageContext,
        previousCss: startingCss,
        previousJs: startingJs,
        promptHistory: prompts.map((item) => item.text),
      } satisfies ExtensionMessage)) as GlossResponse | undefined;

      if (!response) {
        throw new Error('No response from the extension. Reload the page and try again.');
      }

      if (!response.ok) {
        setHasApiKey(!response.needsApiKey);
        throw new Error(toErrorMessage(response.error));
      }

      applyPageCss(response.css);
      if (response.js) {
        await applyPageJs(response.js);
      }
      const entry: SitePrompt = {
        id: newId(),
        text: trimmed,
        summary: response.summary,
        at: Date.now(),
      };
      await persist({
        css: response.css,
        previousCss: startingCss,
        js: response.js || '',
        previousJs: startingJs,
        prompts: [...prompts, entry],
      });
      setPrompt('');
      setStatus(response.summary || 'Applied. Keep iterating if you want.');
      setHasApiKey(true);
      setLogOpen(false);
    } catch (err) {
      applyPageCss(startingCss);
      setCss(startingCss);
      try {
        await applyPageJs(startingJs);
      } catch {
        // Keep CSS fallback even if JS cannot roll back.
      }
      setJs(startingJs);
      setError(toErrorMessage(err));
      setStatus('');
      setStreamText('');
      setLogOpen(false);
    } finally {
      setHiddenForCapture(false);
      setBusy(false);
    }
  }

  async function reset() {
    clearPageCss();
    try {
      await clearPageJs();
    } catch {
      // CSS is already cleared; leftover JS may need a refresh.
    }
    await clearSiteState(origin);
    setCss('');
    setPreviousCss('');
    setJs('');
    setPreviousJs('');
    setPrompts([]);
    setStatus('Cleared styles on this site.');
    setStreamText('');
    setLogOpen(false);
    setError('');
  }

  async function openSettings() {
    try {
      await browser.runtime.sendMessage({ type: 'OPEN_OPTIONS' } satisfies ExtensionMessage);
    } catch (err) {
      setError(toErrorMessage(err) || 'Could not open settings.');
    }
  }

  return (
    <GlossWidget
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      prompt={prompt}
      onPromptChange={setPrompt}
      prompts={prompts}
      css={css || js}
      status={status}
      error={error}
      busy={busy}
      hasApiKey={hasApiKey}
      streamText={streamText}
      logOpen={logOpen}
      onToggleLog={() => setLogOpen((value) => !value)}
      onGloss={(text) => void gloss(text)}
      onReset={() => void reset()}
      onOpenSettings={() => void openSettings()}
      dragging={dragging}
      dock={dock}
      widgetRef={widgetRef}
      consumeClickIfDragged={consumeClickIfDragged}
    />
  );
}

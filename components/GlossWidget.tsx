import { useEffect, useLayoutEffect, useRef, type MouseEvent, type Ref } from 'react';
import type { SitePrompt } from '@/lib/types';

export type GlossSignal = 'idle' | 'ready' | 'needs-key' | 'streaming' | 'error';

export type GlossDockFlags = {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
};

export type GlossWidgetProps = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  prompts: SitePrompt[];
  css: string;
  status: string;
  error: string;
  busy: boolean;
  hasApiKey: boolean;
  streamText: string;
  logOpen: boolean;
  onToggleLog: () => void;
  onGloss: (text: string) => void;
  onReset: () => void;
  onOpenSettings: () => void;
  dragging?: boolean;
  dock?: GlossDockFlags;
  preview?: boolean;
  widgetRef?: Ref<HTMLDivElement>;
  consumeClickIfDragged?: (event: MouseEvent) => boolean;
};

function Spinner() {
  return (
    <span className="spinner" aria-hidden>
      {Array.from({ length: 12 }, (_, index) => (
        <span
          key={index}
          style={{
            transform: `rotate(${index * 30}deg)`,
            animationDelay: `${-index / 12}s`,
          }}
        />
      ))}
    </span>
  );
}

function Orb() {
  return (
    <span className="orb-wrap" aria-hidden>
      <span className="orb-halo" />
      <span className="orb-glow" />
      <span className="orb-core">
        <span className="orb-swirl" />
        <span className="orb-wash" />
        <span className="orb-shade" />
        <span className="orb-shine" />
        <span className="orb-glass" />
      </span>
    </span>
  );
}

export function tickerFromStream(text: string) {
  return text
    .replace(/```(?:css|js|javascript)?/gi, '')
    .replace(/^\s*SUMMARY:\s*.+$/gim, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function streamForLog(text: string) {
  return text.replace(/^\s*SUMMARY:\s*.+$/gim, '').trimEnd();
}

function StreamTicker({ text }: { text: string }) {
  const viewportRef = useRef<HTMLParagraphElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const label = tickerFromStream(text);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const overflow = Math.max(0, track.scrollWidth - viewport.clientWidth);
    track.style.transform = `translate3d(${-overflow}px, 0, 0)`;
  }, [label]);

  return (
    <p ref={viewportRef} className="message streaming-line" aria-live="polite">
      <span ref={trackRef} className="stream-track">
        {label}
      </span>
    </p>
  );
}

export function signalFor(state: {
  error: string;
  busy: boolean;
  streamText: string;
  hasApiKey: boolean;
  css: string;
}): GlossSignal {
  if (state.error) return 'error';
  if (state.busy) return 'streaming';
  if (!state.hasApiKey) return 'needs-key';
  if (state.css) return 'ready';
  return 'idle';
}

export function GlossWidget({
  open,
  onOpen,
  onClose,
  prompt,
  onPromptChange,
  prompts,
  css,
  status,
  error,
  busy,
  hasApiKey,
  streamText,
  logOpen,
  onToggleLog,
  onGloss,
  onReset,
  onOpenSettings,
  dragging = false,
  dock,
  preview = false,
  widgetRef,
  consumeClickIfDragged = () => false,
}: GlossWidgetProps) {
  const streamRef = useRef<HTMLPreElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const threadTops = useRef(new Map<string, number>());
  const signal = signalFor({ error, busy, streamText, hasApiKey, css });
  const history = prompts.slice(-4);
  const followUp = history.length > 0;
  const canSubmit = hasApiKey && !busy && Boolean(prompt.trim());

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [streamText, logOpen]);

  useLayoutEffect(() => {
    const root = threadRef.current;
    if (!root) return;
    root.scrollTop = root.scrollHeight;
    const nodes = [...root.querySelectorAll<HTMLElement>('[data-id]')];
    for (const node of nodes) {
      const id = node.dataset.id;
      if (!id) continue;
      const nextTop = node.getBoundingClientRect().top;
      const prevTop = threadTops.current.get(id);
      if (prevTop != null) {
        const dy = prevTop - nextTop;
        if (Math.abs(dy) > 0.5) {
          node.animate(
            [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
            { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          );
        }
      }
    }
    threadTops.current = new Map(
      nodes.flatMap((node) => {
        const id = node.dataset.id;
        return id ? [[id, node.getBoundingClientRect().top] as const] : [];
      }),
    );
  }, [prompts]);

  useEffect(() => {
    if (!open || busy) return;
    const frame = requestAnimationFrame(() => {
      promptRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, busy]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  const classes = ['widget'];
  if (dragging) classes.push('dragging');
  if (preview) classes.push('preview');

  return (
    <div
      ref={widgetRef}
      className={classes.join(' ')}
      data-left={dock?.left ? '' : undefined}
      data-right={dock?.right ? '' : undefined}
      data-top={dock?.top ? '' : undefined}
      data-bottom={dock?.bottom ? '' : undefined}
    >
      <section
        className={open ? 'shell open' : 'shell'}
        data-signal={signal}
        aria-label="Gloss"
        aria-expanded={open}
      >
        <div className="close-hotzone">
          <button
            className="icon-btn"
            type="button"
            aria-label="Collapse"
            tabIndex={open ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
              <path
                d="M3.2 3.2 12.8 12.8M12.8 3.2 3.2 12.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <header
          className="panel-head drag-handle"
          onClick={(event) => {
            if (open) return;
            if (consumeClickIfDragged(event)) return;
            onOpen();
          }}
        >
          <Orb />
        </header>

        <div className="body" inert={!open}>
          <div className="body-inner">
            {!hasApiKey && (
              <p className="banner">
                Add an API key first.{' '}
                <button type="button" className="linkish" onClick={() => void onOpenSettings()}>
                  Open settings
                </button>
              </p>
            )}

            <form
              className={followUp ? 'composer has-history' : 'composer'}
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSubmit) return;
                onGloss(prompt);
              }}
            >
              <div
                ref={threadRef}
                className="thread"
                aria-label={followUp ? 'Previous prompts' : undefined}
                aria-hidden={!followUp}
              >
                {history.map((item, index) => (
                  <p
                    key={item.id}
                    className={
                      index === history.length - 1 && !busy ? 'thread-item latest' : 'thread-item'
                    }
                    data-id={item.id}
                    data-age={history.length - 1 - index}
                  >
                    {item.text}
                  </p>
                ))}
              </div>
              <textarea
                ref={promptRef}
                rows={followUp ? 4 : 5}
                placeholder={followUp ? 'Make another change…' : 'Make this more zen…'}
                value={prompt}
                disabled={busy || !open}
                onChange={(event) => onPromptChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (!canSubmit) return;
                    onGloss(prompt);
                  }
                }}
              />
              <div className="row">
                <button type="button" className="ghost" disabled={!css || busy} onClick={() => onReset()}>
                  Reset
                </button>
                <button
                  type="submit"
                  className={busy ? 'primary busy' : 'primary'}
                  disabled={!canSubmit}
                  aria-busy={busy}
                >
                  <span className="spinner-slot">
                    <span className="spinner-slot-inner">
                      <Spinner />
                    </span>
                  </span>
                  {followUp ? 'Update' : 'Gloss'}
                </button>
              </div>
            </form>
            <div className="divider" />

            <div
              className={logOpen ? 'output expanded drag-handle' : 'output drag-handle'}
              onClick={(event) => {
                if (consumeClickIfDragged(event)) return;
                onToggleLog();
              }}
            >
              <Orb />
              <div className="output-copy">
                {logOpen && (error || streamText) ? (
                  <pre ref={streamRef} className="stream" aria-live="polite">
                    {error || streamForLog(streamText)}
                  </pre>
                ) : error ? (
                  <p className="message error" role="alert" aria-live="polite">
                    {error}
                  </p>
                ) : busy && streamText ? (
                  <StreamTicker text={streamText} />
                ) : (
                  <p className="message" aria-live="polite">
                    {busy ? 'Working' : status || (css ? 'Applied' : 'Ready')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

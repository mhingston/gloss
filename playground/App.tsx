import { useEffect, useMemo, useRef, useState } from 'react';
import { GlossWidget, type GlossWidgetProps } from '@/components/GlossWidget';
import type { SitePrompt } from '@/lib/types';
import { SAMPLE_STREAM, stories, type Story, type StoryState } from './stories';

function cloneState(state: StoryState): StoryState {
  return {
    ...state,
    prompts: state.prompts.map((item) => ({ ...item })),
  };
}

type Theme = 'system' | 'light' | 'dark';

export function App() {
  const [storyId, setStoryId] = useState(stories[8]?.id ?? stories[0]!.id);
  const [state, setState] = useState<StoryState>(() => cloneState(stories[8]?.state ?? stories[0]!.state));
  const [theme, setTheme] = useState<Theme>('system');
  const streamTimer = useRef(0);

  const story = useMemo(
    () => stories.find((item) => item.id === storyId) ?? stories[0]!,
    [storyId],
  );

  useEffect(() => {
    return () => window.clearInterval(streamTimer.current);
  }, []);

  function selectStory(next: Story) {
    window.clearInterval(streamTimer.current);
    setStoryId(next.id);
    setState(cloneState(next.state));
  }

  function patch(partial: Partial<StoryState>) {
    setState((current) => ({ ...current, ...partial }));
  }

  function handleGloss(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    playStream(() => {
      const entry: SitePrompt = {
        id: `${Date.now()}`,
        text: trimmed,
        summary: 'Applied in playground.',
        at: Date.now(),
      };
      setState((current) => ({
        ...current,
        busy: false,
        prompt: '',
        error: '',
        css: current.css || 'body { filter: contrast(1.05) }',
        status: 'Applied in playground.',
        streamText: SAMPLE_STREAM,
        prompts: [...current.prompts, entry],
      }));
    });
  }

  function playStream(onDone?: () => void) {
    window.clearInterval(streamTimer.current);
    patch({
      busy: true,
      error: '',
      status: '',
      streamText: '',
      logOpen: false,
    });
    let index = 0;
    streamTimer.current = window.setInterval(() => {
      index = Math.min(SAMPLE_STREAM.length, index + 9);
      patch({ streamText: SAMPLE_STREAM.slice(0, index), busy: true });
      if (index >= SAMPLE_STREAM.length) {
        window.clearInterval(streamTimer.current);
        onDone?.();
        if (!onDone) {
          patch({
            busy: false,
            status: 'Warm carnival poster with bouncing type.',
            css: 'body { background: peachpuff }',
          });
        }
      }
    }, 24);
  }

  const groups = [...new Set(stories.map((item) => item.group))];

  const widgetProps: GlossWidgetProps = {
    ...state,
    preview: true,
    dock: { right: true, bottom: false, top: true },
    onOpen: () => patch({ open: true }),
    onClose: () => patch({ open: false, logOpen: false }),
    onPromptChange: (prompt) => patch({ prompt }),
    onToggleLog: () => patch({ logOpen: !state.logOpen }),
    onGloss: handleGloss,
    onReset: () =>
      patch({
        css: '',
        prompts: [],
        status: 'Cleared styles on this site.',
        streamText: '',
        error: '',
      }),
    onOpenSettings: () => patch({ status: 'Settings would open here.' }),
  };

  return (
    <div className="lab">
      <aside className="nav">
        <p className="eyebrow">Gloss</p>
        <h1>Stories</h1>
        {groups.map((group) => (
          <section key={group}>
            <h2>{group}</h2>
            <ul>
              {stories
                .filter((item) => item.group === group)
                .map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={item.id === storyId ? 'active' : ''}
                      onClick={() => selectStory(item)}
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </aside>

      <main className="stage-wrap">
        <header className="stage-head">
          <div>
            <p className="eyebrow">{story.group}</p>
            <h2>{story.name}</h2>
            <p className="hint">{story.hint}</p>
          </div>
          <div className="stage-actions">
            <button type="button" onClick={() => patch({ open: !state.open })}>
              {state.open ? 'Collapse' : 'Open'}
            </button>
            <button type="button" onClick={() => playStream()}>
              Play stream
            </button>
          </div>
        </header>

        <div className={`stage ${state.open ? 'is-open' : 'is-closed'} theme-${theme}`}>
          <div id="gloss-root" data-theme={theme === 'system' ? undefined : theme}>
            <GlossWidget {...widgetProps} />
          </div>
        </div>
      </main>

      <aside className="knobs">
        <p className="eyebrow">Controls</p>
        <label className="stack">
          Theme
          <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.open}
            onChange={(event) => patch({ open: event.target.checked, logOpen: event.target.checked ? state.logOpen : false })}
          />
          Open
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.busy}
            onChange={(event) => patch({ busy: event.target.checked })}
          />
          Busy
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.hasApiKey}
            onChange={(event) => patch({ hasApiKey: event.target.checked })}
          />
          Has API key
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.logOpen}
            onChange={(event) => patch({ logOpen: event.target.checked, open: event.target.checked || state.open })}
          />
          Log open
        </label>
        <label className="stack">
          Prompt
          <input value={state.prompt} onChange={(event) => patch({ prompt: event.target.value })} />
        </label>
        <label className="stack">
          Status
          <input value={state.status} onChange={(event) => patch({ status: event.target.value })} />
        </label>
        <label className="stack">
          Error
          <textarea value={state.error} rows={3} onChange={(event) => patch({ error: event.target.value })} />
        </label>
        <label className="stack">
          History count
          <input
            type="range"
            min={0}
            max={4}
            value={state.prompts.length}
            onChange={(event) => {
              const count = Number(event.target.value);
              const samples = ['make this fun', 'make it funnier', 'more and more', 'keep going'];
              patch({
                prompts: samples.slice(0, count).map((text, index) => ({
                  id: `knob-${index}`,
                  text,
                  at: Date.now() - (count - index) * 1000,
                })),
                css: count > 0 ? state.css || 'body { background: peachpuff }' : state.css,
              });
            }}
          />
        </label>
      </aside>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { getSettings, saveSettings } from '@/lib/storage';
import { DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_PROTOCOL, type ApiProtocol } from '@/lib/types';
import { isUserScriptsAvailable } from '@/lib/userScripts';

type Props = {
  compact?: boolean;
};

export function SettingsForm({ compact = false }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [protocol, setProtocol] = useState<ApiProtocol>(DEFAULT_PROTOCOL);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [userScriptsOn, setUserScriptsOn] = useState(true);

  useEffect(() => {
    void getSettings().then((settings) => {
      setApiKey(settings.apiKey);
      setModel(settings.model);
      setProtocol(settings.protocol);
      setBaseUrl(settings.baseUrl);
      setLoaded(true);
    });

    void isUserScriptsAvailable().then(setUserScriptsOn);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await saveSettings({ apiKey, model, protocol, baseUrl });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  if (!loaded) {
    return <p className="muted">Loading…</p>;
  }

  return (
    <form className={compact ? 'settings compact' : 'settings'} onSubmit={onSubmit}>
      <label>
        <span>API type</span>
        <select value={protocol} onChange={(event) => setProtocol(event.target.value as ApiProtocol)}>
          <option value="openai-chat">OpenAI Chat Completions</option>
        </select>
      </label>
      <label>
        <span>Base URL</span>
        <input
          type="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://api.example.com/v1"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
        />
      </label>
      <label>
        <span>API key</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="API key"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </label>
      <label>
        <span>Model</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="model-name"
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
      </label>
      <p className="hint">
        Gloss appends <code>/chat/completions</code> to the base URL. Existing installs keep using xAI at{' '}
        <code>{DEFAULT_BASE_URL}</code>. Your key stays on this computer and is only sent to the configured upstream.
      </p>
      {!userScriptsOn && (
        <p className="hint">
          JavaScript effects need{' '}
          <button
            type="button"
            className="linkish"
            onClick={() => {
              void browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` });
            }}
          >
            Allow User Scripts
          </button>{' '}
          on the Gloss Details page (not the extensions list).
        </p>
      )}
      <button type="submit">{saved ? 'Saved' : 'Save'}</button>
    </form>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { getSettings, saveSettings } from '@/lib/storage';
import { DEFAULT_MODEL } from '@/lib/types';
import { isUserScriptsAvailable } from '@/lib/userScripts';

type Props = {
  compact?: boolean;
};

export function SettingsForm({ compact = false }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [userScriptsOn, setUserScriptsOn] = useState(true);

  useEffect(() => {
    void getSettings().then((settings) => {
      setApiKey(settings.apiKey);
      setModel(settings.model);
      setLoaded(true);
    });

    void isUserScriptsAvailable().then(setUserScriptsOn);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await saveSettings({ apiKey, model });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  if (!loaded) {
    return <p className="muted">Loading…</p>;
  }

  return (
    <form className={compact ? 'settings compact' : 'settings'} onSubmit={onSubmit}>
      <label>
        <span>xAI API key</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="xai-..."
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </label>
      <p className="hint">
        Get a key at{' '}
        <a href="https://console.x.ai/" target="_blank" rel="noreferrer">
          console.x.ai
        </a>
        . It stays on this computer.
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

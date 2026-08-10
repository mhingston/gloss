import type { Settings, SiteState } from './types';
import { DEFAULT_MODEL } from './types';

const SETTINGS_KEY = 'settings';
const SITES_KEY = 'sites';

const EMPTY_SITE: SiteState = {
  css: '',
  previousCss: '',
  js: '',
  previousJs: '',
  prompts: [],
};

export async function getSettings(): Promise<Settings> {
  const data = await browser.storage.local.get(SETTINGS_KEY);
  const stored = data[SETTINGS_KEY] as Partial<Settings> | undefined;
  return {
    apiKey: stored?.apiKey?.trim() ?? '',
    model: stored?.model?.trim() || DEFAULT_MODEL,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({
    [SETTINGS_KEY]: {
      apiKey: settings.apiKey.trim(),
      model: settings.model.trim() || DEFAULT_MODEL,
    },
  });
}

export async function getSiteState(origin: string): Promise<SiteState> {
  const data = await browser.storage.local.get(SITES_KEY);
  const sites = (data[SITES_KEY] as Record<string, SiteState> | undefined) ?? {};
  return sites[origin] ?? { ...EMPTY_SITE };
}

export async function saveSiteState(origin: string, state: SiteState): Promise<void> {
  const data = await browser.storage.local.get(SITES_KEY);
  const sites = (data[SITES_KEY] as Record<string, SiteState> | undefined) ?? {};
  sites[origin] = {
    ...state,
    prompts: state.prompts.slice(-12),
  };
  await browser.storage.local.set({ [SITES_KEY]: sites });
}

export async function clearSiteState(origin: string): Promise<void> {
  const data = await browser.storage.local.get(SITES_KEY);
  const sites = (data[SITES_KEY] as Record<string, SiteState> | undefined) ?? {};
  delete sites[origin];
  await browser.storage.local.set({ [SITES_KEY]: sites });
}

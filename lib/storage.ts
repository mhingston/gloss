import type { ApiProtocol, Settings, SiteState } from './types';
import { DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_PROTOCOL } from './types';

const SETTINGS_KEY = 'settings';
const SITES_KEY = 'sites';

// Settings saved before provider configuration existed only contained apiKey/model.
const LEGACY_XAI_BASE_URL = 'https://api.x.ai/v1';
const LEGACY_XAI_MODEL = 'grok-4.5';

const EMPTY_SITE: SiteState = {
  css: '',
  previousCss: '',
  js: '',
  previousJs: '',
  prompts: [],
};

const PROTOCOLS = new Set<ApiProtocol>([
  'openai-chat',
  'openai-responses',
  'anthropic-messages',
]);

export async function getSettings(): Promise<Settings> {
  const data = await browser.storage.local.get(SETTINGS_KEY);
  const stored = data[SETTINGS_KEY] as Partial<Settings> | undefined;

  if (!stored) {
    return {
      apiKey: '',
      model: DEFAULT_MODEL,
      protocol: DEFAULT_PROTOCOL,
      baseUrl: DEFAULT_BASE_URL,
    };
  }

  const isLegacyXaiSettings = stored.protocol == null && stored.baseUrl == null;
  if (isLegacyXaiSettings) {
    return {
      apiKey: stored.apiKey?.trim() ?? '',
      model: stored.model?.trim() || LEGACY_XAI_MODEL,
      protocol: 'openai-chat',
      baseUrl: LEGACY_XAI_BASE_URL,
    };
  }

  const protocol = PROTOCOLS.has(stored.protocol as ApiProtocol)
    ? (stored.protocol as ApiProtocol)
    : DEFAULT_PROTOCOL;

  return {
    apiKey: stored.apiKey?.trim() ?? '',
    model: stored.model?.trim() || DEFAULT_MODEL,
    protocol,
    baseUrl: stored.baseUrl?.trim() || DEFAULT_BASE_URL,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({
    [SETTINGS_KEY]: {
      apiKey: settings.apiKey.trim(),
      model: settings.model.trim(),
      protocol: settings.protocol,
      baseUrl: settings.baseUrl.trim(),
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

export const DEFAULT_MODEL = 'grok-4.5';

export const MODELS = [
  { id: 'grok-4.5', label: 'Grok 4.5' },
  { id: 'grok-4.3', label: 'Grok 4.3 (cheaper)' },
] as const;

export type SitePrompt = {
  id: string;
  text: string;
  summary?: string;
  at: number;
};

export type SiteState = {
  css: string;
  previousCss: string;
  js: string;
  previousJs: string;
  prompts: SitePrompt[];
};

export type PageContext = {
  url: string;
  title: string;
  viewport: string;
  theme: {
    background: string;
    color: string;
    font: string;
  };
  landmarks: Array<{
    tag: string;
    id?: string;
    role?: string;
    classes: string[];
  }>;
  samples: Array<{
    tag: string;
    text?: string;
    testid?: string;
    classes: string[];
  }>;
};

export type Settings = {
  apiKey: string;
  model: string;
};

export type GlossRequest = {
  type: 'GLOSS';
  prompt: string;
  pageContext: PageContext;
  previousCss: string;
  previousJs: string;
  promptHistory: string[];
};

export type GlossSuccess = {
  ok: true;
  css: string;
  js: string;
  summary?: string;
};

export type GlossFailure = {
  ok: false;
  error: string;
  needsApiKey?: boolean;
};

export type GlossResponse = GlossSuccess | GlossFailure;

export type GlossStarted = {
  type: 'GLOSS_STARTED';
};

export type GlossProgress = {
  type: 'GLOSS_PROGRESS';
  css: string;
  text: string;
};

export type ExtensionMessage =
  | GlossRequest
  | GlossStarted
  | GlossProgress
  | { type: 'HAS_SETTINGS' }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'RUN_PAGE_JS'; source: string }
  | { type: 'SET_ICON_THEME'; dark: boolean };

export type HasSettingsResponse = {
  hasApiKey: boolean;
  model: string;
};

export const DEFAULT_PROTOCOL: ApiProtocol = 'openai-chat';
export const DEFAULT_BASE_URL = 'https://api.x.ai/v1';
export const DEFAULT_MODEL = 'grok-4.5';

export type ApiProtocol = 'openai-chat' | 'openai-responses' | 'anthropic-messages';

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

export type PageRegionKind =
  | 'header'
  | 'nav'
  | 'main'
  | 'aside'
  | 'footer'
  | 'article'
  | 'form'
  | 'dialog'
  | 'region';

export type PageRegionImportance = 'primary' | 'supporting' | 'chrome';

export type PageContext = {
  url: string;
  title: string;
  viewport: string;
  theme: {
    background: string;
    color: string;
    font: string;
    fontSize: string;
    lineHeight: string;
    customProperties: Array<{
      name: string;
      value: string;
    }>;
  };
  landmarks: Array<{
    tag: string;
    id?: string;
    role?: string;
    classes: string[];
    kind: PageRegionKind;
    importance: PageRegionImportance;
    interactive: boolean;
    label?: string;
  }>;
  interaction: {
    links: number;
    buttons: number;
    inputs: number;
    forms: number;
    dialogs: number;
  };
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
  protocol: ApiProtocol;
  baseUrl: string;
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

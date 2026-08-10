import type { SitePrompt } from '@/lib/types';
import type { GlossWidgetProps } from '@/components/GlossWidget';

export type StoryState = Pick<
  GlossWidgetProps,
  | 'open'
  | 'prompt'
  | 'prompts'
  | 'css'
  | 'status'
  | 'error'
  | 'busy'
  | 'hasApiKey'
  | 'streamText'
  | 'logOpen'
>;

export type Story = {
  id: string;
  name: string;
  group: string;
  hint: string;
  state: StoryState;
};

const SAMPLE_CSS = `\`\`\`css
html, body {
  background: radial-gradient(circle at top, #ffb38a, #f07a4a) !important;
  color: #1a120c !important;
}
h1 {
  font-family: ui-serif, Georgia, serif !important;
  transform: rotate(-1.5deg);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
p {
  letter-spacing: 0.01em !important;
  max-width: 34rem !important;
}
a, button {
  border-radius: 999px !important;
  padding: 8px 16px !important;
}
\`\`\`
SUMMARY: Warm carnival poster with bouncing type.`;

function promptAt(text: string, hoursAgo: number): SitePrompt {
  return {
    id: text.replace(/\s+/g, '-'),
    text,
    summary: text,
    at: Date.now() - hoursAgo * 3600_000,
  };
}

export const SAMPLE_STREAM = SAMPLE_CSS;

export const stories: Story[] = [
  {
    id: 'collapsed-idle',
    name: 'Collapsed · idle',
    group: 'Collapsed',
    hint: 'Default orb before anything has been applied.',
    state: {
      open: false,
      prompt: '',
      prompts: [],
      css: '',
      status: '',
      error: '',
      busy: false,
      hasApiKey: true,
      streamText: '',
      logOpen: false,
    },
  },
  {
    id: 'collapsed-ready',
    name: 'Collapsed · ready',
    group: 'Collapsed',
    hint: 'Styles are already on the page.',
    state: {
      open: false,
      prompt: '',
      prompts: [promptAt('make this fun', 1)],
      css: 'body { background: peachpuff }',
      status: 'Applied',
      error: '',
      busy: false,
      hasApiKey: true,
      streamText: '',
      logOpen: false,
    },
  },
  {
    id: 'collapsed-streaming',
    name: 'Collapsed · streaming',
    group: 'Collapsed',
    hint: 'Orb while CSS is coming in.',
    state: {
      open: false,
      prompt: 'make this fun',
      prompts: [],
      css: '',
      status: '',
      error: '',
      busy: true,
      hasApiKey: true,
      streamText: SAMPLE_CSS,
      logOpen: false,
    },
  },
  {
    id: 'collapsed-error',
    name: 'Collapsed · error',
    group: 'Collapsed',
    hint: 'Failed restyle, orb only.',
    state: {
      open: false,
      prompt: 'make this fun',
      prompts: [],
      css: '',
      status: '',
      error: 'xAI rejected the API key. Check it in the extension popup.',
      busy: false,
      hasApiKey: true,
      streamText: '',
      logOpen: false,
    },
  },
  {
    id: 'open-empty',
    name: 'Open · first prompt',
    group: 'Open',
    hint: 'Fresh panel, no history yet.',
    state: {
      open: true,
      prompt: '',
      prompts: [],
      css: '',
      status: '',
      error: '',
      busy: false,
      hasApiKey: true,
      streamText: '',
      logOpen: false,
    },
  },
  {
    id: 'open-typed',
    name: 'Open · typed prompt',
    group: 'Open',
    hint: 'Ready to submit the first restyle.',
    state: {
      open: true,
      prompt: 'make this more zen',
      prompts: [],
      css: '',
      status: '',
      error: '',
      busy: false,
      hasApiKey: true,
      streamText: '',
      logOpen: false,
    },
  },
  {
    id: 'open-needs-key',
    name: 'Open · needs API key',
    group: 'Open',
    hint: 'Banner + needs-key orb.',
    state: {
      open: true,
      prompt: 'make this fun',
      prompts: [],
      css: '',
      status: '',
      error: '',
      busy: false,
      hasApiKey: false,
      streamText: '',
      logOpen: false,
    },
  },
  {
    id: 'open-history-1',
    name: 'Open · one follow-up',
    group: 'History',
    hint: 'Single previous prompt above the input.',
    state: {
      open: true,
      prompt: '',
      prompts: [promptAt('make this fun', 1)],
      css: 'body { background: peachpuff }',
      status: 'Turned the page into a playful candy-colored card.',
      error: '',
      busy: false,
      hasApiKey: true,
      streamText: '',
      logOpen: false,
    },
  },
  {
    id: 'open-history-3',
    name: 'Open · stacked history',
    group: 'History',
    hint: 'Older prompts push up and fade.',
    state: {
      open: true,
      prompt: '',
      prompts: [
        promptAt('make this fun', 3),
        promptAt('make it funnier', 2),
        promptAt('more and more', 1),
      ],
      css: 'body { background: peachpuff }',
      status: 'Amped up the party chaos with dual confetti streams.',
      error: '',
      busy: false,
      hasApiKey: true,
      streamText: '',
      logOpen: false,
    },
  },
  {
    id: 'open-history-overflow',
    name: 'Open · history overflow',
    group: 'History',
    hint: 'More than the visible slot — should clip at the top.',
    state: {
      open: true,
      prompt: '',
      prompts: [
        promptAt('make this a newspaper', 4),
        promptAt('make this fun', 3),
        promptAt('make it funnier', 2),
        promptAt('more and more', 1),
      ],
      css: 'body { background: peachpuff }',
      status: 'Applied',
      error: '',
      busy: false,
      hasApiKey: true,
      streamText: '',
      logOpen: false,
    },
  },
  {
    id: 'open-streaming',
    name: 'Open · streaming',
    group: 'Streaming',
    hint: 'Ticker in the status row.',
    state: {
      open: true,
      prompt: 'make this fun',
      prompts: [promptAt('make this more zen', 1)],
      css: '',
      status: '',
      error: '',
      busy: true,
      hasApiKey: true,
      streamText: SAMPLE_CSS,
      logOpen: false,
    },
  },
  {
    id: 'open-log',
    name: 'Open · stream expanded',
    group: 'Streaming',
    hint: 'Full CSS log under the orb.',
    state: {
      open: true,
      prompt: 'make this fun',
      prompts: [promptAt('make this more zen', 1)],
      css: 'h1 { color: tomato }',
      status: '',
      error: '',
      busy: true,
      hasApiKey: true,
      streamText: SAMPLE_CSS,
      logOpen: true,
    },
  },
  {
    id: 'open-error',
    name: 'Open · error',
    group: 'Error',
    hint: 'Red orb plus wrapped error copy.',
    state: {
      open: true,
      prompt: 'make this fun',
      prompts: [promptAt('make this more zen', 1)],
      css: '',
      status: '',
      error: 'This key cannot use that model.',
      busy: false,
      hasApiKey: true,
      streamText: '',
      logOpen: false,
    },
  },
];

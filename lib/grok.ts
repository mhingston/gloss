import { extractStreamableCss, parseModelOutput } from './css';
import type { PageContext } from './types';

const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions';

const SHARED_RULES = `Rules:
- Start with the CSS fence immediately. No preface.
- Emit complete CSS rules as early as possible: html/body/fonts/colors/backgrounds first, then surfaces, then controls.
- Change the look in a noticeable, cohesive way. Do not be timid.
- Keep the site usable: never hide primary content, destroy scrolling, disable inputs, or cover click targets.
- Prefer semantic tags, roles, [data-testid], aria attributes, and stable class names. Avoid hashed one-off utility classes unless required.
- Use !important when the host stylesheet would otherwise win.
- You may hide noisy chrome (ads, right-rail trends, dense counters) if it serves the request.
- Do not include selectors or script that target the extension UI (gloss-panel, #gloss-root, or anything gloss-).`;

const SYSTEM_PROMPT_CSS = `You restyle live websites with CSS only. Do not output JavaScript, HTML, or markdown commentary.

The user will send a screenshot of the current viewport plus a short page structure dump. Match what you see. Iterate on previous CSS when provided instead of starting over, unless they ask for a reset or a totally different look.

Return EXACTLY this shape and nothing else:
\`\`\`css
/* css here */
\`\`\`
SUMMARY: <one sentence describing the visual change>

${SHARED_RULES}
- CSS only. No JavaScript.`;

const SYSTEM_PROMPT_JS = `You restyle live websites. Prefer CSS. Add JavaScript only when CSS cannot do the job (structure changes, extra nodes, canvas/particles, behavior CSS cannot express).

The user will send a screenshot of the current viewport plus a short page structure dump. Match what you see. Iterate on previous CSS/JS when provided instead of starting over, unless they ask for a reset or a totally different look.

Return EXACTLY this shape and nothing else. CSS fence FIRST so it can stream onto the page:
\`\`\`css
/* css here */
\`\`\`
\`\`\`js
(() => {
  window.__glossCleanup?.();
  // apply DOM/behavior changes
  window.__glossCleanup = () => {
    // undo this script
  };
})();
\`\`\`
SUMMARY: <one sentence describing the visual change>

If JavaScript is not needed, omit the js fence entirely.

${SHARED_RULES}
- JavaScript runs in an isolated user-script world: it can use document/DOM APIs, not the page's own globals (no site React/jQuery).
- JavaScript must be a self-contained IIFE. Set window.__glossCleanup to undo nodes, listeners, intervals, and class changes you added.
- No network requests, no cookies/localStorage/sessionStorage access, no credentials, no innerHTML of untrusted strings, no eval of page strings.
- Do not navigate or replace location. Guard every querySelector. Fail silently if a node is missing.`;

export async function glossWithGrok(options: {
  apiKey: string;
  model: string;
  prompt: string;
  screenshotDataUrl: string;
  pageContext: PageContext;
  previousCss: string;
  previousJs: string;
  promptHistory: string[];
  allowJs: boolean;
  onProgress?: (update: { text: string; css: string }) => void;
}): Promise<{ css: string; js: string; summary?: string }> {
  const history =
    options.promptHistory.length > 0
      ? options.promptHistory.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : '(none)';

  const userText = [
    `URL: ${options.pageContext.url}`,
    `Title: ${options.pageContext.title}`,
    `Viewport: ${options.pageContext.viewport}`,
    `Computed body: bg=${options.pageContext.theme.background}; color=${options.pageContext.theme.color}; font=${options.pageContext.theme.font}`,
    `Landmarks: ${JSON.stringify(options.pageContext.landmarks)}`,
    `Visible samples: ${JSON.stringify(options.pageContext.samples)}`,
    `Prior prompts on this page:\n${history}`,
    options.previousCss
      ? `CSS already injected (iterate on this):\n${options.previousCss}`
      : 'No CSS injected yet. Start fresh.',
    options.allowJs
      ? options.previousJs
        ? `JavaScript already injected (iterate on this; it will be cleaned up first):\n${options.previousJs}`
        : 'No JavaScript injected yet.'
      : 'JavaScript injection is disabled. CSS only.',
    `User request: ${options.prompt}`,
  ].join('\n\n');

  const response = await fetch(XAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      stream: true,
      temperature: 0.4,
      max_tokens: 8000,
      messages: [
        { role: 'system', content: options.allowJs ? SYSTEM_PROMPT_JS : SYSTEM_PROMPT_CSS },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: options.screenshotDataUrl, detail: 'high' },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(formatXaiError(response.status, raw));
  }

  if (!response.body) {
    throw new Error('Grok returned an empty stream.');
  }

  const text = await readSseText(response.body, (partial) => {
    options.onProgress?.({
      text: partial,
      css: extractStreamableCss(partial),
    });
  });

  if (!text.trim()) {
    throw new Error('Grok returned an empty response.');
  }

  const parsed = parseModelOutput(text);
  if (!options.allowJs) parsed.js = '';
  const hasCss = Boolean(parsed.css && parsed.css.length >= 8);
  const hasJs = Boolean(parsed.js && parsed.js.length >= 8);
  if (!hasCss && !hasJs) {
    throw new Error(
      options.allowJs
        ? 'Grok did not return usable CSS or JavaScript. Try a more specific prompt.'
        : 'Grok did not return usable CSS. Try a more specific prompt.',
    );
  }

  return parsed;
}

async function readSseText(
  body: ReadableStream<Uint8Array>,
  onPartial: (text: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const payload = line.startsWith('data:') ? line.slice(5).trim() : '';
      if (!payload || payload === '[DONE]') continue;

      let delta = '';
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        delta = json.choices?.[0]?.delta?.content ?? '';
      } catch {
        continue;
      }

      if (!delta) continue;
      text += delta;
      onPartial(text);
    }
  }

  return text;
}

function formatXaiError(status: number, raw: string): string {
  let detail = '';
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string };
    if (typeof parsed.error === 'string') detail = parsed.error;
    else if (parsed.error?.message) detail = parsed.error.message;
  } catch {
    detail = raw.replace(/\s+/g, ' ').trim();
  }

  const text = detail.toLowerCase();
  if (status === 401 || status === 403) return 'API key rejected. Check settings.';
  if (status === 429) return 'Rate limited. Try again in a moment.';
  if (status >= 500) return 'xAI is down. Try again shortly.';
  if (/not available|does not have access|unknown model|does not exist/.test(text)) {
    return 'This key cannot use that model.';
  }
  if (detail && detail.length <= 56) return detail;
  return status ? `Request failed (${status}).` : 'Request failed.';
}

import { extractStreamableCss, parseModelOutput } from './css';
import { streamAnthropicMessages } from './llm/anthropicMessages';
import { streamOpenAIChat } from './llm/openaiChat';
import { streamOpenAIResponses } from './llm/openaiResponses';
import type { PageContext, Settings } from './types';

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

export async function glossWithModel(options: {
  settings: Settings;
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

  const transportOptions = {
    baseUrl: options.settings.baseUrl,
    apiKey: options.settings.apiKey,
    model: options.settings.model,
    systemPrompt: options.allowJs ? SYSTEM_PROMPT_JS : SYSTEM_PROMPT_CSS,
    userText,
    screenshotDataUrl: options.screenshotDataUrl,
    onPartial(partial: string) {
      options.onProgress?.({
        text: partial,
        css: extractStreamableCss(partial),
      });
    },
  };

  let text: string;
  switch (options.settings.protocol) {
    case 'openai-chat':
      text = await streamOpenAIChat(transportOptions);
      break;
    case 'openai-responses':
      text = await streamOpenAIResponses(transportOptions);
      break;
    case 'anthropic-messages':
      text = await streamAnthropicMessages(transportOptions);
      break;
    default:
      throw new Error('That API type is not supported by this version of Gloss.');
  }

  if (!text.trim()) throw new Error('The configured upstream returned an empty response.');

  const parsed = parseModelOutput(text);
  if (!options.allowJs) parsed.js = '';
  const hasCss = Boolean(parsed.css && parsed.css.length >= 8);
  const hasJs = Boolean(parsed.js && parsed.js.length >= 8);
  if (!hasCss && !hasJs) {
    throw new Error(
      options.allowJs
        ? 'The model did not return usable CSS or JavaScript. Try a more specific prompt.'
        : 'The model did not return usable CSS. Try a more specific prompt.',
    );
  }

  return parsed;
}

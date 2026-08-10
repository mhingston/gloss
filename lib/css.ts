const STYLE_ID = 'gloss-overrides';

export function applyPageCss(css: string): void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css.trim()) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    el.setAttribute('data-gloss', 'true');
    document.documentElement.appendChild(el);
  }
  el.textContent = `${css}

gloss-panel {
  all: initial !important;
  display: block !important;
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  overflow: visible !important;
  pointer-events: none !important;
  background: transparent !important;
  filter: none !important;
  transform: none !important;
  opacity: 1 !important;
  clip-path: none !important;
}
`;
}

export function clearPageCss(): void {
  document.getElementById(STYLE_ID)?.remove();
}

export function parseModelOutput(text: string): { css: string; js: string; summary?: string } {
  const summary = extractSummary(text);
  const css = extractFenced(text, ['css'], true)?.trim() ?? '';
  const js = extractFenced(text, ['js', 'javascript'], true)?.trim() ?? '';
  return { css, js, summary };
}

export function extractStreamableCss(text: string): string {
  const body = (extractFenced(text, ['css'], false) ?? '').trimStart();
  const lastBrace = body.lastIndexOf('}');
  if (lastBrace === -1) return '';
  return body.slice(0, lastBrace + 1).trim();
}

function extractSummary(text: string): string | undefined {
  return text.match(/^\s*SUMMARY:\s*(.+)$/im)?.[1]?.trim();
}

function extractFenced(text: string, languages: string[], requireClose: boolean): string | undefined {
  const alt = languages.map(escapeRegExp).join('|');
  const openRe = new RegExp('```(?:' + alt + ')\\b[\\t ]*\\n?', 'i');
  const open = openRe.exec(text);
  if (!open || open.index == null) return undefined;
  const start = open.index + open[0].length;
  const close = text.indexOf('```', start);
  if (close === -1) return requireClose ? undefined : text.slice(start);
  return text.slice(start, close);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pageIsDark(): boolean {
  const root = document.documentElement;
  const body = document.body;
  const scheme = `${getComputedStyle(root).colorScheme} ${body ? getComputedStyle(body).colorScheme : ''}`;
  if (/\bdark\b/i.test(scheme) && !/\blight\b/i.test(scheme)) return true;
  if (/\blight\b/i.test(scheme) && !/\bdark\b/i.test(scheme)) return false;

  const attr = `${root.getAttribute('data-theme') ?? ''} ${root.getAttribute('data-color-mode') ?? ''} ${root.className} ${body?.className ?? ''}`;
  if (/\bdark\b/i.test(attr) && !/\blight\b/i.test(attr)) return true;
  if (/\blight\b/i.test(attr) && !/\bdark\b/i.test(attr)) return false;

  const fill = firstOpaqueBackground(body) ?? firstOpaqueBackground(root);
  if (!fill) return window.matchMedia('(prefers-color-scheme: dark)').matches;
  return luminance(fill) < 0.45;
}

export function watchPageTheme(onChange: (dark: boolean) => void): () => void {
  let current = pageIsDark();
  onChange(current);

  const emit = () => {
    const next = pageIsDark();
    if (next === current) return;
    current = next;
    onChange(next);
  };

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', emit);
  const observer = new MutationObserver(emit);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'],
    });
  }

  return () => {
    media.removeEventListener('change', emit);
    observer.disconnect();
  };
}

function firstOpaqueBackground(el: Element | null): string | null {
  if (!el) return null;
  const value = getComputedStyle(el).backgroundColor;
  const match = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/i);
  if (!match) return null;
  const alpha = match[4] == null ? 1 : Number(match[4]);
  if (alpha < 0.6) return null;
  return value;
}

function luminance(color: string): number {
  const match = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/i);
  if (!match) return 1;
  const channel = [Number(match[1]), Number(match[2]), Number(match[3])].map((value) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channel[0]! + 0.7152 * channel[1]! + 0.0722 * channel[2]!;
}

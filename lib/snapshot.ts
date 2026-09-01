import type { PageContext, PageRegionImportance, PageRegionKind } from './types';

const REGION_SELECTOR = [
  'header',
  'nav',
  'main',
  'aside',
  'footer',
  'article',
  'form',
  'dialog',
  '[role="banner"]',
  '[role="navigation"]',
  '[role="main"]',
  '[role="complementary"]',
  '[role="contentinfo"]',
  '[role="article"]',
  '[role="form"]',
  '[role="dialog"]',
  '[role="region"]',
].join(', ');

const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, [role="button"], [contenteditable="true"]';

function stableClasses(el: Element): string[] {
  return [...el.classList]
    .filter((cls) => cls.length > 1 && cls.length < 48)
    .filter((cls) => !/^[a-f0-9]{6,}$/i.test(cls))
    .filter((cls) => !/\d{5,}/.test(cls))
    .slice(0, 6);
}

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function regionKind(el: Element): PageRegionKind {
  const role = el.getAttribute('role');
  switch (role) {
    case 'banner':
      return 'header';
    case 'navigation':
      return 'nav';
    case 'main':
      return 'main';
    case 'complementary':
      return 'aside';
    case 'contentinfo':
      return 'footer';
    case 'article':
      return 'article';
    case 'form':
      return 'form';
    case 'dialog':
      return 'dialog';
    case 'region':
      return 'region';
  }

  const tag = el.tagName.toLowerCase();
  if (
    tag === 'header' ||
    tag === 'nav' ||
    tag === 'main' ||
    tag === 'aside' ||
    tag === 'footer' ||
    tag === 'article' ||
    tag === 'form' ||
    tag === 'dialog'
  ) {
    return tag;
  }
  return 'region';
}

function regionImportance(kind: PageRegionKind): PageRegionImportance {
  if (kind === 'main' || kind === 'article' || kind === 'form' || kind === 'dialog') {
    return 'primary';
  }
  if (kind === 'header' || kind === 'nav' || kind === 'footer') return 'chrome';
  return 'supporting';
}

function regionLabel(el: Element): string | undefined {
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel.slice(0, 80);

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) return text.slice(0, 80);
  }

  const heading = el.querySelector('h1, h2, h3');
  const text = heading?.textContent?.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 80) : undefined;
}

function captureCustomProperties(...styles: Array<CSSStyleDeclaration | null>): PageContext['theme']['customProperties'] {
  const properties: PageContext['theme']['customProperties'] = [];
  const seen = new Set<string>();

  for (const style of styles) {
    if (!style) continue;
    for (let i = 0; i < style.length && properties.length < 24; i += 1) {
      const name = style.item(i);
      if (!name.startsWith('--') || seen.has(name)) continue;
      const value = style.getPropertyValue(name).trim();
      if (!value || value.length > 120) continue;
      seen.add(name);
      properties.push({ name, value });
    }
  }

  return properties;
}

function visibleSamples(): PageContext['samples'] {
  const candidates = [
    ...document.querySelectorAll('button, a, h1, h2, input, [data-testid], [role="button"]'),
  ].slice(0, 80);

  return candidates
    .filter(isVisible)
    .slice(0, 24)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 48) || undefined,
      testid: el.getAttribute('data-testid') || undefined,
      classes: stableClasses(el),
    }));
}

export function capturePageContext(): PageContext {
  const body = document.body;
  const root = document.documentElement;
  const bodyStyle = body ? getComputedStyle(body) : null;
  const rootStyle = root ? getComputedStyle(root) : null;

  const landmarks = [...document.querySelectorAll(REGION_SELECTOR)]
    .slice(0, 40)
    .filter(isVisible)
    .slice(0, 20)
    .map((el) => {
      const kind = regionKind(el);
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        role: el.getAttribute('role') || undefined,
        classes: stableClasses(el),
        kind,
        importance: regionImportance(kind),
        interactive: kind === 'form' || kind === 'dialog' || Boolean(el.querySelector(INTERACTIVE_SELECTOR)),
        label: regionLabel(el),
      };
    });

  return {
    url: location.href,
    title: document.title,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    theme: {
      background: bodyStyle?.backgroundColor ?? '',
      color: bodyStyle?.color ?? '',
      font: bodyStyle?.fontFamily ?? '',
      fontSize: bodyStyle?.fontSize ?? '',
      lineHeight: bodyStyle?.lineHeight ?? '',
      customProperties: captureCustomProperties(rootStyle, bodyStyle),
    },
    landmarks,
    interaction: {
      links: document.querySelectorAll('a[href]').length,
      buttons: document.querySelectorAll('button, [role="button"]').length,
      inputs: document.querySelectorAll('input, select, textarea, [contenteditable="true"]').length,
      forms: document.querySelectorAll('form, [role="form"]').length,
      dialogs: document.querySelectorAll('dialog, [role="dialog"]').length,
    },
    samples: visibleSamples(),
  };
}

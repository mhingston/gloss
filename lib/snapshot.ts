import type { PageContext } from './types';

function stableClasses(el: Element): string[] {
  return [...el.classList]
    .filter((cls) => cls.length > 1 && cls.length < 48)
    .filter((cls) => !/^[a-f0-9]{6,}$/i.test(cls))
    .filter((cls) => !/\d{5,}/.test(cls))
    .slice(0, 6);
}

export function capturePageContext(): PageContext {
  const body = document.body;
  const cs = body ? getComputedStyle(body) : null;

  const landmarks = [
    ...document.querySelectorAll(
      'header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"]',
    ),
  ]
    .slice(0, 16)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      role: el.getAttribute('role') || undefined,
      classes: stableClasses(el),
    }));

  const samples = [
    ...document.querySelectorAll('button, a, h1, h2, input, [data-testid], [role="button"]'),
  ]
    .slice(0, 24)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 48) || undefined,
      testid: el.getAttribute('data-testid') || undefined,
      classes: stableClasses(el),
    }));

  return {
    url: location.href,
    title: document.title,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    theme: {
      background: cs?.backgroundColor ?? '',
      color: cs?.color ?? '',
      font: cs?.fontFamily ?? '',
    },
    landmarks,
    samples,
  };
}

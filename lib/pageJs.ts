export async function applyPageJs(source: string): Promise<void> {
  const response = (await browser.runtime.sendMessage({
    type: 'RUN_PAGE_JS',
    source,
  })) as { ok: boolean; error?: string } | undefined;
  if (!response?.ok) {
    throw new Error(response?.error || 'Could not inject JavaScript.');
  }

  const host = document.querySelector('gloss-panel');
  if (host instanceof HTMLElement) {
    host.style.setProperty('background', 'transparent', 'important');
    host.style.setProperty('width', '0px', 'important');
    host.style.setProperty('height', '0px', 'important');
    host.style.setProperty('pointer-events', 'none', 'important');
  }
}

export async function clearPageJs(): Promise<void> {
  await applyPageJs('');
}

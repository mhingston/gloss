export function endpointUrl(baseUrl: string, endpoint: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const path = endpoint.replace(/^\/+/, '');
  const suffix = `/${path}`;
  return base.endsWith(suffix) ? base : `${base}${suffix}`;
}

export async function readSseJson(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: unknown) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const consumeLine = (line: string) => {
    const payload = line.startsWith('data:') ? line.slice(5).trim() : '';
    if (!payload || payload === '[DONE]') return;

    let event: unknown;
    try {
      event = JSON.parse(payload);
    } catch {
      // Ignore malformed/non-JSON SSE events from compatible upstreams.
      return;
    }
    onEvent(event);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) consumeLine(line);
  }

  buffer += decoder.decode();
  if (buffer) consumeLine(buffer);
}

export async function responseError(response: Response): Promise<Error> {
  const raw = await response.text();
  let detail = '';
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof parsed.error === 'string') detail = parsed.error;
    else if (parsed.error?.message) detail = parsed.error.message;
    else if (parsed.message) detail = parsed.message;
  } catch {
    detail = raw.replace(/\s+/g, ' ').trim();
  }

  const text = detail.toLowerCase();
  if (response.status === 401 || response.status === 403) {
    return new Error('API key rejected. Check settings.');
  }
  if (response.status === 429) return new Error('Rate limited. Try again in a moment.');
  if (response.status >= 500) return new Error('The configured upstream is unavailable.');
  if (/not available|does not have access|unknown model|does not exist|model not found/.test(text)) {
    return new Error('The configured upstream cannot use that model.');
  }
  if (detail && detail.length <= 120) return new Error(detail);
  return new Error(response.status ? `Request failed (${response.status}).` : 'Request failed.');
}

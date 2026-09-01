import { endpointUrl, readSseJson, responseError } from './common';

type AnthropicStreamEvent = {
  type?: string;
  delta?: {
    type?: string;
    text?: string;
  };
  error?: {
    message?: string;
  };
};

export async function streamAnthropicMessages(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
  screenshotDataUrl: string;
  onPartial?: (text: string) => void;
}): Promise<string> {
  const image = parseDataUrl(options.screenshotDataUrl);
  const response = await fetch(endpointUrl(options.baseUrl, 'messages'), {
    method: 'POST',
    headers: {
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      stream: true,
      max_tokens: 8000,
      system: options.systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.mediaType,
                data: image.data,
              },
            },
            { type: 'text', text: options.userText },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw await responseError(response);
  if (!response.body) throw new Error('The configured upstream returned an empty stream.');

  let text = '';
  await readSseJson(response.body, (rawEvent) => {
    const event = rawEvent as AnthropicStreamEvent;
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta' &&
      typeof event.delta.text === 'string'
    ) {
      text += event.delta.text;
      options.onPartial?.(text);
      return;
    }

    if (event.type === 'error') {
      throw new Error(event.error?.message || 'The configured upstream returned a streaming error.');
    }
  });

  return text;
}

function parseDataUrl(value: string): { mediaType: string; data: string } {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(value);
  if (!match?.[1] || !match[2]) {
    throw new Error('Gloss could not encode the screenshot for Anthropic Messages.');
  }
  return { mediaType: match[1], data: match[2] };
}

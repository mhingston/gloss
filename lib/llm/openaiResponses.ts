import { endpointUrl, readSseJson, responseError } from './common';

type OpenAIResponseEvent = {
  type?: string;
  delta?: string;
  error?: { message?: string };
  response?: { error?: { message?: string } | null };
};

export async function streamOpenAIResponses(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
  screenshotDataUrl: string;
  onPartial?: (text: string) => void;
}): Promise<string> {
  const response = await fetch(endpointUrl(options.baseUrl, 'responses'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      stream: true,
      instructions: options.systemPrompt,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: options.screenshotDataUrl,
              detail: 'high',
            },
            { type: 'input_text', text: options.userText },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw await responseError(response);
  if (!response.body) throw new Error('The configured upstream returned an empty stream.');

  let text = '';
  await readSseJson(response.body, (rawEvent) => {
    const event = rawEvent as OpenAIResponseEvent;
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      text += event.delta;
      options.onPartial?.(text);
      return;
    }

    if (event.type === 'error') {
      throw new Error(event.error?.message || 'The configured upstream returned a streaming error.');
    }

    if (event.type === 'response.failed') {
      throw new Error(
        event.response?.error?.message || 'The configured upstream failed to generate a response.',
      );
    }
  });

  return text;
}

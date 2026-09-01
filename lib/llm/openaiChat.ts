import { endpointUrl, readSseJson, responseError } from './common';

type OpenAIChatChunk = {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

export async function streamOpenAIChat(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
  screenshotDataUrl: string;
  onPartial?: (text: string) => void;
}): Promise<string> {
  const response = await fetch(endpointUrl(options.baseUrl, 'chat/completions'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      stream: true,
      messages: [
        { role: 'system', content: options.systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: options.screenshotDataUrl, detail: 'high' },
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
  await readSseJson(response.body, (event) => {
    const chunk = event as OpenAIChatChunk;
    const content = chunk.choices?.[0]?.delta?.content;
    const delta =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((part) => part.text ?? '').join('')
          : '';
    if (!delta) return;
    text += delta;
    options.onPartial?.(text);
  });

  return text;
}

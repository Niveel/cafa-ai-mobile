import { apiEndpoints } from '@/services/api';
import { ChatStreamEvent } from '@/types';

export async function streamChatMessage(
  conversationId: string,
  body: FormData,
  onEvent: (event: ChatStreamEvent) => void,
) {
  const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:5000'}${apiEndpoints.chat.messages(conversationId)}`, {
    method: 'POST',
    body,
  });

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;

      try {
        const payload = JSON.parse(line.replace(/^data:\s*/, '')) as ChatStreamEvent;
        onEvent(payload);
      } catch {
        // no-op parse guard for scaffold stage
      }
    }
  }
}

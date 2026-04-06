import { apiEndpoints } from '@/services/api';
import { API_BASE_URL } from '@/lib';
import { ChatStreamEvent } from '@/types';

export async function streamChatMessage(
  conversationId: string,
  body: FormData,
  onEvent: (event: ChatStreamEvent) => void,
) {
  const response = await fetch(`${API_BASE_URL}${apiEndpoints.chat.messages(conversationId)}`, {
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

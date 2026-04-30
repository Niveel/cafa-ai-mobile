import { STARTER_PROMPT_POOL, STARTER_PROMPTS_PER_CHAT } from './constants';

export function shufflePrompts(items: readonly string[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
  }
  return next;
}

export function createStarterPromptCycler(
  pool: readonly string[] = STARTER_PROMPT_POOL,
  promptsPerChat: number = STARTER_PROMPTS_PER_CHAT,
) {
  let queue: string[] = [];

  return function nextStarterPrompts() {
    const selected: string[] = [];

    while (selected.length < promptsPerChat) {
      if (!queue.length) {
        queue = shufflePrompts(pool);
      }
      const nextPrompt = queue.pop();
      if (!nextPrompt) break;
      selected.push(nextPrompt);
    }

    return selected;
  };
}

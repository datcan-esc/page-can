export const SCRATCHPAD_WORD_LIMIT = 3_000;
export const SCRATCHPAD_CHARACTER_LIMIT = 50_000;

export function countScratchpadWords(value: string): number {
  return value.match(/\S+/gu)?.length ?? 0;
}

export function normalizeScratchpadText(value: unknown): string {
  if (typeof value !== 'string') return '';

  const text = value.replace(/\r\n?/g, '\n').slice(0, SCRATCHPAD_CHARACTER_LIMIT);
  const words = text.matchAll(/\S+/gu);
  let wordCount = 0;

  for (const word of words) {
    wordCount += 1;
    if (wordCount > SCRATCHPAD_WORD_LIMIT) {
      return text.slice(0, word.index);
    }
  }

  return text;
}

export const TODO_TEXT_MAX_LENGTH = 500;

export function normalizeTodoText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, TODO_TEXT_MAX_LENGTH)
    .trimEnd();
}

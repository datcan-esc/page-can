import type { Todo, TodoTag } from './types';
import { createId } from './utils';

export const TODO_TEXT_MAX_LENGTH = 500;
export const TODO_TAG_NAME_MAX_LENGTH = 32;
export const TODO_TAG_LIMIT = 200;
export const TODO_TAGS_PER_TODO_LIMIT = 12;
export const TODO_DRAFT_MAX_LENGTH = TODO_TEXT_MAX_LENGTH
  + (TODO_TAG_NAME_MAX_LENGTH + 2) * TODO_TAGS_PER_TODO_LIMIT;

export const TODO_TAG_COLORS = [
  '#5e7cf7',
  '#756cf2',
  '#9a67e8',
  '#cf5d9e',
  '#dc6464',
  '#dc8142',
  '#c39624',
  '#3d9b61',
  '#2d9b8f',
  '#378fac',
] as const;

export interface ParsedTodoDraft {
  title: string;
  tagNames: string[];
}

export interface TodoTagTrigger {
  start: number;
  end: number;
  query: string;
}

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

function normalizeTodoDraftText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, TODO_DRAFT_MAX_LENGTH)
    .trimEnd();
}

export function normalizeTodoTagName(value: string): string {
  return value
    .normalize('NFC')
    .replace(/^#+/, '')
    .trim()
    .slice(0, TODO_TAG_NAME_MAX_LENGTH);
}

export function isValidTodoTagName(value: string): boolean {
  const normalized = normalizeTodoTagName(value);
  return Boolean(normalized)
    && normalized === value.replace(/^#+/, '').trim()
    && /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(normalized);
}

export function todoTagKey(value: string): string {
  return normalizeTodoTagName(value).toLocaleLowerCase('tr-TR');
}

export function todoTagColor(value: string): string {
  const normalized = todoTagKey(value);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return TODO_TAG_COLORS[(hash >>> 0) % TODO_TAG_COLORS.length] ?? TODO_TAG_COLORS[0];
}

export function cycleTodoTagFilter(
  tags: Array<Pick<TodoTag, 'id'>>,
  selectedTagId: string,
  direction: number,
): string {
  const options = ['', ...tags.map((tag) => tag.id)];
  if (options.length <= 1) return '';
  const currentIndex = Math.max(0, options.indexOf(selectedTagId));
  const offset = direction < 0 ? -1 : 1;
  return options[(currentIndex + offset + options.length) % options.length] ?? '';
}

export function parseTodoDraft(value: string): ParsedTodoDraft {
  let remaining = normalizeTodoDraftText(value);
  const tagNames: string[] = [];
  const seen = new Set<string>();

  while (remaining.startsWith('#') && tagNames.length < TODO_TAGS_PER_TODO_LIMIT) {
    const match = remaining.match(
      new RegExp(`^#([\\p{L}\\p{N}][\\p{L}\\p{N}_-]{0,${TODO_TAG_NAME_MAX_LENGTH - 1}})(?=\\s|$)`, 'u'),
    );
    if (!match?.[1]) break;
    const name = normalizeTodoTagName(match[1]);
    const key = todoTagKey(name);
    if (!seen.has(key)) {
      tagNames.push(name);
      seen.add(key);
    }
    remaining = remaining.slice(match[0].length).trimStart();
  }

  return { title: normalizeTodoText(remaining), tagNames };
}

export function todoDraftText(todo: Todo, tags: TodoTag[]): string {
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const prefix = todo.tagIds
    .flatMap((id) => {
      const tag = tagsById.get(id);
      return tag ? [`#${tag.name}`] : [];
    })
    .join(' ');
  return [prefix, todo.title].filter(Boolean).join(' ');
}

export function resolveTodoTags(
  tagNames: string[],
  currentTags: TodoTag[],
  now = Date.now(),
): { tags: TodoTag[]; tagIds: string[] } {
  const tags = [...currentTags];
  const byName = new Map(tags.map((tag) => [todoTagKey(tag.name), tag]));
  const tagIds: string[] = [];

  for (const candidate of tagNames.slice(0, TODO_TAGS_PER_TODO_LIMIT)) {
    const name = normalizeTodoTagName(candidate);
    if (!isValidTodoTagName(name)) continue;
    const key = todoTagKey(name);
    let tag = byName.get(key);
    if (!tag && tags.length < TODO_TAG_LIMIT) {
      tag = {
        id: createId('todo-tag'),
        name,
        color: todoTagColor(name),
        createdAt: now,
      };
      tags.push(tag);
      byName.set(key, tag);
    }
    if (tag && !tagIds.includes(tag.id)) tagIds.push(tag.id);
  }

  return { tags, tagIds };
}

export function todoTagTriggerAt(value: string, caret: number): TodoTagTrigger | null {
  const safeCaret = Math.max(0, Math.min(caret, value.length));
  const tokenStart = Math.max(
    value.lastIndexOf(' ', safeCaret - 1),
    value.lastIndexOf('\n', safeCaret - 1),
    value.lastIndexOf('\t', safeCaret - 1),
  ) + 1;
  const before = value.slice(0, tokenStart);
  const completeLeadingTags = new RegExp(
    `^\\s*(?:#[\\p{L}\\p{N}][\\p{L}\\p{N}_-]{0,${TODO_TAG_NAME_MAX_LENGTH - 1}}\\s+)*$`,
    'u',
  );
  if (!completeLeadingTags.test(before)) return null;

  const token = value.slice(tokenStart).match(/^#([^\s#]*)/u)?.[0];
  if (!token || safeCaret > tokenStart + token.length) return null;
  const query = token.slice(1);
  if (
    query.length > TODO_TAG_NAME_MAX_LENGTH
    || (query && !/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(query))
  ) {
    return null;
  }
  return { start: tokenStart, end: tokenStart + token.length, query };
}

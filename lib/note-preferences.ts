import { browser } from 'wxt/browser';
import type { NoteRef } from './notes';

export const NOTES_UI_STATE_KEY = 'notesUiState';

export const NOTE_FOLDER_COLORS = [
  'neutral',
  'blue',
  'purple',
  'pink',
  'red',
  'orange',
  'yellow',
  'green',
] as const;

export type NoteFolderColor = typeof NOTE_FOLDER_COLORS[number];

export interface NotesUiState {
  hasNotes: boolean;
  lastNote: NoteRef | null;
  lastCategory: string | null;
  migrationVersion: number;
  folderColors: Record<string, NoteFolderColor>;
}

const DEFAULT_NOTES_UI_STATE: NotesUiState = {
  hasNotes: false,
  lastNote: null,
  lastCategory: null,
  migrationVersion: 0,
  folderColors: {},
};

const folderColorSet = new Set<string>(NOTE_FOLDER_COLORS);

function normalizeNoteRef(value: unknown): NoteRef | null {
  if (!value || typeof value !== 'object') return null;
  const ref = value as Partial<NoteRef>;
  if (typeof ref.fileName !== 'string' || !ref.fileName) return null;
  if (ref.category !== null && typeof ref.category !== 'string') return null;
  return { category: ref.category ?? null, fileName: ref.fileName };
}

function normalizeFolderColors(value: unknown): Record<string, NoteFolderColor> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const colors: Record<string, NoteFolderColor> = {};
  for (const [name, color] of Object.entries(value).slice(0, 100)) {
    if (
      !name
      || name.length > 80
      || name === '__proto__'
      || name === 'constructor'
      || name === 'prototype'
      || typeof color !== 'string'
      || !folderColorSet.has(color)
    ) continue;
    colors[name] = color as NoteFolderColor;
  }
  return colors;
}

export function normalizeNotesUiState(value: unknown): NotesUiState {
  const source = value && typeof value === 'object' ? value as Partial<NotesUiState> : {};
  return {
    hasNotes: source.hasNotes === true,
    lastNote: normalizeNoteRef(source.lastNote),
    lastCategory: typeof source.lastCategory === 'string' ? source.lastCategory : null,
    migrationVersion: Number.isInteger(source.migrationVersion)
      ? Math.max(0, Number(source.migrationVersion))
      : 0,
    folderColors: normalizeFolderColors(source.folderColors),
  };
}

export async function loadNotesUiState(): Promise<NotesUiState> {
  const result = await browser.storage.local.get(NOTES_UI_STATE_KEY);
  return normalizeNotesUiState(result[NOTES_UI_STATE_KEY]);
}

export async function updateNotesUiState(patch: Partial<NotesUiState>): Promise<NotesUiState> {
  const current = await loadNotesUiState().catch(() => DEFAULT_NOTES_UI_STATE);
  const next = normalizeNotesUiState({ ...current, ...patch });
  await browser.storage.local.set({ [NOTES_UI_STATE_KEY]: next });
  return next;
}

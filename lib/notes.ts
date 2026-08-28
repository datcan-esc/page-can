export const NOTE_FILE_EXTENSION = '.txt';
export const NOTES_RECOMMENDED_WORD_LIMIT = 3_000;
export const NOTES_RECOMMENDED_CHARACTER_LIMIT = 50_000;
export const NOTES_EDITOR_BYTE_LIMIT = 1_048_576;
export const NOTES_NAME_MAX_LENGTH = 80;
export const NOTES_TRASH_DIRECTORY = '.page-can-trash';
export const UNCATEGORIZED_LABEL = 'Kategorisiz';

export type NotesPermissionState = 'granted' | 'prompt' | 'denied';
export type NotesConnectionState =
  | 'loading'
  | 'disconnected'
  | 'permission-needed'
  | 'ready'
  | 'unavailable'
  | 'unsupported';

export interface NoteRef {
  category: string | null;
  fileName: string;
}

export interface NoteSummary {
  ref: NoteRef;
  title: string;
}

export interface NoteVersion {
  lastModified: number;
  size: number;
  hash: string;
}

export interface NoteDocument extends NoteSummary {
  text: string;
  version: NoteVersion;
  readOnlyReason?: 'too-large' | 'unsupported-encoding';
}

export interface NoteCategory {
  name: string;
}

export interface NotesWorkspaceSnapshot {
  categories: NoteCategory[];
  uncategorizedNotes: NoteSummary[];
  hasNotes: boolean;
}

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const INVALID_FILE_NAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f\u007f]/gu;
const turkishCollator = new Intl.Collator('tr-TR', {
  numeric: true,
  sensitivity: 'base',
});

export function normalizeNoteText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n?/gu, '\n') : '';
}

export function countNoteWords(value: string): number {
  return value.match(/\S+/gu)?.length ?? 0;
}

export function compareNoteNames(left: string, right: string): number {
  return turkishCollator.compare(left, right);
}

export function canonicalNoteName(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('tr-TR');
}

export function sanitizeEntryName(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value : '';
  const withoutExtension = raw.trim().replace(/\.txt$/iu, '');
  const normalized = withoutExtension
    .normalize('NFC')
    .replace(INVALID_FILE_NAME_CHARACTERS, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/^[. ]+/gu, '')
    .replace(/[. ]+$/gu, '');
  const limited = [...normalized].slice(0, NOTES_NAME_MAX_LENGTH).join('').replace(/[. ]+$/gu, '');
  const candidate = limited || fallback;
  return WINDOWS_RESERVED_NAME.test(candidate) ? `${candidate} notu` : candidate;
}

export function sanitizeNoteTitle(value: unknown): string {
  return sanitizeEntryName(value, 'Adsız not');
}

export function sanitizeCategoryName(value: unknown): string {
  if (
    typeof value === 'string'
    && canonicalNoteName(value.trim()) === canonicalNoteName(NOTES_TRASH_DIRECTORY)
  ) return 'Yeni kategori';
  const name = sanitizeEntryName(value, 'Yeni kategori');
  return canonicalNoteName(name) === canonicalNoteName(NOTES_TRASH_DIRECTORY)
    ? 'Yeni kategori'
    : name;
}

export function noteTitleFromFileName(fileName: string): string {
  return fileName.replace(/\.txt$/iu, '');
}

export function noteFileNameFromTitle(title: unknown): string {
  return `${sanitizeNoteTitle(title)}${NOTE_FILE_EXTENSION}`;
}

export function isTextNoteFileName(fileName: string): boolean {
  return !fileName.startsWith('.')
    && fileName.length > NOTE_FILE_EXTENSION.length
    && fileName.toLocaleLowerCase('tr-TR').endsWith(NOTE_FILE_EXTENSION);
}

export function isVisibleCategoryName(name: string): boolean {
  return !name.startsWith('.')
    && canonicalNoteName(name) !== canonicalNoteName(NOTES_TRASH_DIRECTORY);
}

function uniqueEntryName(
  desired: string,
  existing: Iterable<string>,
  extension = '',
): string {
  const occupied = new Set([...existing].map(canonicalNoteName));
  const base = extension && desired.toLocaleLowerCase('tr-TR').endsWith(extension)
    ? desired.slice(0, -extension.length)
    : desired;
  if (!occupied.has(canonicalNoteName(`${base}${extension}`))) return `${base}${extension}`;

  for (let index = 2; index < 10_000; index += 1) {
    const suffix = ` (${index})`;
    const availableLength = Math.max(1, NOTES_NAME_MAX_LENGTH - [...suffix].length);
    const limitedBase = [...base].slice(0, availableLength).join('').replace(/[. ]+$/gu, '');
    const candidate = `${limitedBase}${suffix}${extension}`;
    if (!occupied.has(canonicalNoteName(candidate))) return candidate;
  }

  throw new Error('Benzersiz bir ad oluşturulamadı.');
}

export function uniqueNoteFileName(title: unknown, existing: Iterable<string>): string {
  return uniqueEntryName(noteFileNameFromTitle(title), existing, NOTE_FILE_EXTENSION);
}

export function uniqueCategoryName(name: unknown, existing: Iterable<string>): string {
  return uniqueEntryName(sanitizeCategoryName(name), existing);
}

export function noteRefKey(ref: NoteRef): string {
  return `${ref.category ?? ''}/${ref.fileName}`;
}

export function notePathLabel(ref: NoteRef): string {
  return ref.category ? `${ref.category} / ${ref.fileName}` : ref.fileName;
}

export function sameNoteRef(left: NoteRef | null, right: NoteRef | null): boolean {
  if (!left || !right) return left === right;
  return canonicalNoteName(left.category ?? '') === canonicalNoteName(right.category ?? '')
    && canonicalNoteName(left.fileName) === canonicalNoteName(right.fileName);
}

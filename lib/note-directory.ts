import {
  NOTES_EDITOR_BYTE_LIMIT,
  NOTES_TRASH_DIRECTORY,
  UNCATEGORIZED_LABEL,
  canonicalNoteName,
  compareNoteNames,
  isTextNoteFileName,
  isVisibleCategoryName,
  normalizeNoteText,
  noteFileNameFromTitle,
  noteTitleFromFileName,
  sameNoteRef,
  sanitizeCategoryName,
  uniqueCategoryName,
  uniqueNoteFileName,
  type NoteCategory,
  type NoteDocument,
  type NoteRef,
  type NotesPermissionState,
  type NoteSummary,
  type NotesWorkspaceSnapshot,
  type NoteVersion,
} from './notes';

type PermissionCapableHandle = FileSystemHandle & {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<NotesPermissionState>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<NotesPermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }) => Promise<FileSystemDirectoryHandle>;
};

export class NotesConflictError extends Error {
  constructor(public readonly ref: NoteRef) {
    super('Bu not başka bir uygulamada değiştirildi.');
    this.name = 'NotesConflictError';
  }
}

export class NotesFileError extends Error {
  constructor(message: string, public readonly code = 'file-error') {
    super(message);
    this.name = 'NotesFileError';
  }
}

export function supportsNotesDirectoryAccess(target: Window = window): boolean {
  return typeof (target as DirectoryPickerWindow).showDirectoryPicker === 'function';
}

export async function pickNotesDirectory(
  target: Window = window,
): Promise<FileSystemDirectoryHandle | null> {
  const picker = (target as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new NotesFileError('Bu tarayıcı klasör erişimini desteklemiyor.', 'unsupported');

  try {
    return await picker.call(target, {
      id: 'page-can-notes',
      mode: 'readwrite',
      startIn: 'documents',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}

export async function queryNotesDirectoryPermission(
  handle: FileSystemDirectoryHandle,
): Promise<NotesPermissionState> {
  const permissionHandle = handle as PermissionCapableHandle;
  return permissionHandle.queryPermission
    ? permissionHandle.queryPermission({ mode: 'readwrite' })
    : 'granted';
}

export async function requestNotesDirectoryPermission(
  handle: FileSystemDirectoryHandle,
): Promise<NotesPermissionState> {
  const permissionHandle = handle as PermissionCapableHandle;
  return permissionHandle.requestPermission
    ? permissionHandle.requestPermission({ mode: 'readwrite' })
    : 'granted';
}

async function hashBytes(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function readFileVersion(file: File, bytes?: ArrayBuffer): Promise<NoteVersion> {
  const content = bytes ?? await file.arrayBuffer();
  return {
    lastModified: file.lastModified,
    size: file.size,
    hash: await hashBytes(content),
  };
}

function decodeUtf8(bytes: ArrayBuffer): string {
  try {
    return normalizeNoteText(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new NotesFileError('Bu dosya UTF-8 biçiminde değil.', 'unsupported-encoding');
  }
}

async function directoryEntryNames(directory: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const [name] of directory.entries()) names.push(name);
  return names;
}

async function fileHandleOrNull(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemFileHandle | null> {
  try {
    return await directory.getFileHandle(name);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw error;
  }
}

export class DirectoryNotesRepository {
  constructor(public readonly root: FileSystemDirectoryHandle) {}

  async snapshot(): Promise<NotesWorkspaceSnapshot> {
    const [categories, uncategorizedNotes] = await Promise.all([
      this.listCategories(),
      this.listNotes(null),
    ]);
    let hasNotes = uncategorizedNotes.length > 0;

    if (!hasNotes) {
      for (const category of categories) {
        if (await this.categoryHasNotes(category.name)) {
          hasNotes = true;
          break;
        }
      }
    }

    return { categories, uncategorizedNotes, hasNotes };
  }

  async listCategories(): Promise<NoteCategory[]> {
    const categories: NoteCategory[] = [];
    for await (const [name, handle] of this.root.entries()) {
      if (handle.kind === 'directory' && isVisibleCategoryName(name)) categories.push({ name });
    }
    return categories.sort((left, right) => compareNoteNames(left.name, right.name));
  }

  async listNotes(category: string | null): Promise<NoteSummary[]> {
    const directory = await this.directoryFor(category);
    const notes: NoteSummary[] = [];
    for await (const [fileName, handle] of directory.entries()) {
      if (handle.kind !== 'file' || !isTextNoteFileName(fileName)) continue;
      notes.push({
        ref: { category, fileName },
        title: noteTitleFromFileName(fileName),
      });
    }
    return notes.sort((left, right) => compareNoteNames(left.title, right.title));
  }

  async readNote(ref: NoteRef): Promise<NoteDocument> {
    const directory = await this.directoryFor(ref.category);
    const handle = await directory.getFileHandle(ref.fileName);
    const file = await handle.getFile();

    if (file.size > NOTES_EDITOR_BYTE_LIMIT) {
      return {
        ref,
        title: noteTitleFromFileName(ref.fileName),
        text: '',
        version: { lastModified: file.lastModified, size: file.size, hash: '' },
        readOnlyReason: 'too-large',
      };
    }

    const bytes = await file.arrayBuffer();
    let text = '';
    try {
      text = decodeUtf8(bytes);
    } catch (error) {
      if (!(error instanceof NotesFileError) || error.code !== 'unsupported-encoding') throw error;
      return {
        ref,
        title: noteTitleFromFileName(ref.fileName),
        text: '',
        version: await readFileVersion(file, bytes),
        readOnlyReason: 'unsupported-encoding',
      };
    }

    return {
      ref,
      title: noteTitleFromFileName(ref.fileName),
      text,
      version: await readFileVersion(file, bytes),
    };
  }

  async createNote(category: string | null, title = 'Adsız not', text = ''): Promise<NoteDocument> {
    const directory = await this.directoryFor(category);
    const fileName = uniqueNoteFileName(title, await directoryEntryNames(directory));
    if (await fileHandleOrNull(directory, fileName)) {
      throw new NotesFileError('Aynı adlı bir dosya az önce oluşturuldu. Tekrar deneyin.', 'name-collision');
    }
    const handle = await directory.getFileHandle(fileName, { create: true });
    await this.writeHandle(handle, normalizeNoteText(text));
    return this.readNote({ category, fileName });
  }

  async saveNote(
    ref: NoteRef,
    text: string,
    expectedVersion: NoteVersion,
    overwrite = false,
  ): Promise<NoteDocument> {
    const directory = await this.directoryFor(ref.category);
    const handle = await directory.getFileHandle(ref.fileName);
    if (!overwrite) await this.assertUnchanged(handle, ref, expectedVersion);
    await this.writeHandle(handle, normalizeNoteText(text));
    return this.readNote(ref);
  }

  async renameNote(ref: NoteRef, title: string): Promise<NoteDocument> {
    const desiredFileName = noteFileNameFromTitle(title);
    if (desiredFileName === ref.fileName) return this.readNote(ref);
    if (canonicalNoteName(desiredFileName) === canonicalNoteName(ref.fileName)) {
      throw new NotesFileError(
        'Yalnızca büyük/küçük harf değiştiren adlar desteklenmiyor. Önce farklı bir ad deneyin.',
        'case-only-rename',
      );
    }
    const destination = await this.relocate(ref, ref.category, desiredFileName);
    return this.readNote(destination);
  }

  async moveNote(ref: NoteRef, category: string | null): Promise<NoteDocument> {
    if (sameNoteRef(ref, { ...ref, category })) return this.readNote(ref);
    const destination = await this.relocate(ref, category, ref.fileName);
    return this.readNote(destination);
  }

  async trashNote(ref: NoteRef): Promise<void> {
    const trash = await this.root.getDirectoryHandle(NOTES_TRASH_DIRECTORY, { create: true });
    const categoryDirectory = await trash.getDirectoryHandle(ref.category ?? UNCATEGORIZED_LABEL, { create: true });
    await this.relocateToDirectory(ref, categoryDirectory, ref.fileName, ref.category, false);
  }

  async createCategory(name: string): Promise<NoteCategory> {
    const categories = await this.listCategories();
    const categoryName = uniqueCategoryName(name, categories.map((category) => category.name));
    await this.root.getDirectoryHandle(categoryName, { create: true });
    return { name: categoryName };
  }

  async renameCategory(category: string, name: string): Promise<NoteCategory> {
    const nextBase = sanitizeCategoryName(name);
    if (nextBase === category) return { name: category };
    if (canonicalNoteName(nextBase) === canonicalNoteName(category)) {
      throw new NotesFileError(
        'Yalnızca büyük/küçük harf değiştiren kategori adları desteklenmiyor.',
        'case-only-rename',
      );
    }

    const source = await this.directoryFor(category);
    for await (const [entryName, handle] of source.entries()) {
      if (handle.kind !== 'file' || !isTextNoteFileName(entryName)) {
        throw new NotesFileError(
          'Bu kategoride not dışı dosya veya alt klasör var. Kategoriyi dosya yöneticisinden yeniden adlandırın.',
          'category-has-unknown-entries',
        );
      }
    }

    const categories = await this.listCategories();
    const nextName = uniqueCategoryName(
      nextBase,
      categories.filter((item) => item.name !== category).map((item) => item.name),
    );
    await this.root.getDirectoryHandle(nextName, { create: true });
    const notes = await this.listNotes(category);
    for (const note of notes) await this.relocate(note.ref, nextName, note.ref.fileName);
    await this.root.removeEntry(category);
    return { name: nextName };
  }

  async removeEmptyCategory(category: string): Promise<void> {
    const directory = await this.directoryFor(category);
    for await (const _entry of directory.entries()) {
      throw new NotesFileError(
        'Kategori boş değil. Silmeden önce içindeki notları başka bir kategoriye taşıyın.',
        'category-not-empty',
      );
    }
    await this.root.removeEntry(category);
  }

  private async categoryHasNotes(category: string): Promise<boolean> {
    const directory = await this.directoryFor(category);
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind === 'file' && isTextNoteFileName(name)) return true;
    }
    return false;
  }

  private async directoryFor(category: string | null): Promise<FileSystemDirectoryHandle> {
    return category ? this.root.getDirectoryHandle(category) : this.root;
  }

  private async assertUnchanged(
    handle: FileSystemFileHandle,
    ref: NoteRef,
    expected: NoteVersion,
  ): Promise<void> {
    const current = await handle.getFile();
    if (current.lastModified === expected.lastModified && current.size === expected.size) return;
    const currentVersion = await readFileVersion(current);
    if (currentVersion.hash !== expected.hash) throw new NotesConflictError(ref);
  }

  private async writeHandle(handle: FileSystemFileHandle, value: string | ArrayBuffer): Promise<void> {
    const writable = await handle.createWritable();
    try {
      await writable.write(value);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => undefined);
      throw error;
    }
  }

  private async relocate(
    sourceRef: NoteRef,
    targetCategory: string | null,
    requestedFileName: string,
  ): Promise<NoteRef> {
    const targetDirectory = await this.directoryFor(targetCategory);
    const sameDirectory = canonicalNoteName(sourceRef.category ?? '')
      === canonicalNoteName(targetCategory ?? '');
    return this.relocateToDirectory(
      sourceRef,
      targetDirectory,
      requestedFileName,
      targetCategory,
      sameDirectory,
    );
  }

  private async relocateToDirectory(
    sourceRef: NoteRef,
    targetDirectory: FileSystemDirectoryHandle,
    requestedFileName: string,
    targetCategory: string | null,
    sameDirectory: boolean,
  ): Promise<NoteRef> {
    const sourceDirectory = await this.directoryFor(sourceRef.category);
    const sourceHandle = await sourceDirectory.getFileHandle(sourceRef.fileName);
    const sourceFile = await sourceHandle.getFile();
    const sourceBytes = await sourceFile.arrayBuffer();
    const sourceHash = await hashBytes(sourceBytes);
    const existing = await directoryEntryNames(targetDirectory);
    const withoutSource = sameDirectory
      ? existing.filter((name) => name !== sourceRef.fileName)
      : existing;
    const requestedTitle = noteTitleFromFileName(requestedFileName);
    const targetFileName = uniqueNoteFileName(requestedTitle, withoutSource);

    const existingTarget = await fileHandleOrNull(targetDirectory, targetFileName);
    if (existingTarget && await existingTarget.isSameEntry(sourceHandle)) {
      return sourceRef;
    }
    if (existingTarget) {
      throw new NotesFileError('Hedefte aynı adlı bir dosya var. İşlemi tekrar deneyin.', 'name-collision');
    }

    const targetHandle = await targetDirectory.getFileHandle(targetFileName, { create: true });
    try {
      await this.writeHandle(targetHandle, sourceBytes);
      const targetFile = await targetHandle.getFile();
      const targetHash = await hashBytes(await targetFile.arrayBuffer());
      if (sourceHash !== targetHash) {
        throw new NotesFileError('Dosya taşınırken içerik doğrulanamadı.', 'verification-failed');
      }

      const latestSource = await sourceHandle.getFile();
      const latestSourceHash = await hashBytes(await latestSource.arrayBuffer());
      if (latestSourceHash !== sourceHash) {
        throw new NotesConflictError(sourceRef);
      }
    } catch (error) {
      await targetDirectory.removeEntry(targetFileName).catch(() => undefined);
      throw error;
    }

    try {
      await sourceDirectory.removeEntry(sourceRef.fileName);
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;
    }
    return { category: targetCategory, fileName: targetFileName };
  }
}

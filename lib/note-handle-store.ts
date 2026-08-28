const NOTES_DATABASE_NAME = 'page-can-notes';
const NOTES_DATABASE_VERSION = 2;
const NOTES_HANDLE_STORE = 'handles';
const NOTES_RECOVERY_STORE = 'recovery';
const ROOT_HANDLE_KEY = 'root-directory';
const ACTIVE_RECOVERY_KEY = 'active-draft';

export interface NoteRecoveryDraft {
  category: string | null;
  fileName: string;
  text: string;
  baseHash: string;
  updatedAt: number;
}

function openNotesDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOTES_DATABASE_NAME, NOTES_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(NOTES_HANDLE_STORE)) {
        request.result.createObjectStore(NOTES_HANDLE_STORE);
      }
      if (!request.result.objectStoreNames.contains(NOTES_RECOVERY_STORE)) {
        request.result.createObjectStore(NOTES_RECOVERY_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Not veritabanı açılamadı.'));
  });
}

async function runHandleRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openNotesDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Not klasörü bilgisi işlenemedi.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Not klasörü işlemi iptal edildi.'));
    });
  } finally {
    database.close();
  }
}

export async function loadNotesDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await runHandleRequest<unknown>(
    NOTES_HANDLE_STORE,
    'readonly',
    (store) => store.get(ROOT_HANDLE_KEY),
  );
  return handle && typeof handle === 'object' && (handle as FileSystemHandle).kind === 'directory'
    ? handle as FileSystemDirectoryHandle
    : null;
}

export async function saveNotesDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await runHandleRequest(
    NOTES_HANDLE_STORE,
    'readwrite',
    (store) => store.put(handle, ROOT_HANDLE_KEY),
  );
}

export async function clearNotesDirectoryHandle(): Promise<void> {
  await runHandleRequest(
    NOTES_HANDLE_STORE,
    'readwrite',
    (store) => store.delete(ROOT_HANDLE_KEY),
  );
}

export async function loadNoteRecoveryDraft(): Promise<NoteRecoveryDraft | null> {
  const value = await runHandleRequest<unknown>(
    NOTES_RECOVERY_STORE,
    'readonly',
    (store) => store.get(ACTIVE_RECOVERY_KEY),
  );
  if (!value || typeof value !== 'object') return null;
  const draft = value as Partial<NoteRecoveryDraft>;
  if (
    typeof draft.fileName !== 'string'
    || typeof draft.text !== 'string'
    || typeof draft.baseHash !== 'string'
    || typeof draft.updatedAt !== 'number'
    || (draft.category !== null && typeof draft.category !== 'string')
  ) return null;
  return {
    category: draft.category ?? null,
    fileName: draft.fileName,
    text: draft.text,
    baseHash: draft.baseHash,
    updatedAt: draft.updatedAt,
  };
}

export async function saveNoteRecoveryDraft(draft: NoteRecoveryDraft): Promise<void> {
  await runHandleRequest(
    NOTES_RECOVERY_STORE,
    'readwrite',
    (store) => store.put(draft, ACTIVE_RECOVERY_KEY),
  );
}

export async function clearNoteRecoveryDraft(): Promise<void> {
  await runHandleRequest(
    NOTES_RECOVERY_STORE,
    'readwrite',
    (store) => store.delete(ACTIVE_RECOVERY_KEY),
  );
}

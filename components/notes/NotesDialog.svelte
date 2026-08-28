<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    DirectoryNotesRepository,
    NotesConflictError,
    pickNotesDirectory,
    queryNotesDirectoryPermission,
    requestNotesDirectoryPermission,
    supportsNotesDirectoryAccess,
  } from '../../lib/note-directory';
  import {
    clearNoteRecoveryDraft,
    clearNotesDirectoryHandle,
    loadNoteRecoveryDraft,
    loadNotesDirectoryHandle,
    saveNoteRecoveryDraft,
    saveNotesDirectoryHandle,
    type NoteRecoveryDraft,
  } from '../../lib/note-handle-store';
  import {
    loadNotesUiState,
    updateNotesUiState,
    type NoteFolderColor,
  } from '../../lib/note-preferences';
  import {
    UNCATEGORIZED_LABEL,
    normalizeNoteText,
    noteRefKey,
    noteTitleFromFileName,
    sameNoteRef,
    type NoteCategory,
    type NoteDocument,
    type NoteRef,
    type NotesConnectionState,
    type NotesWorkspaceSnapshot,
    type NoteSummary,
    type NoteVersion,
  } from '../../lib/notes';
  import { clearScratchpadText, loadScratchpadText } from '../../lib/storage';
  import { createId } from '../../lib/utils';
  import Button from '../ui/Button.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import './notes.css';

  export let onClose: () => void;
  export let onPresenceChange: (hasNotes: boolean) => void = () => undefined;

  type SaveState = 'saved' | 'saving' | 'error' | 'conflict';

  interface TreeGroup {
    key: string;
    category: string | null;
    label: string;
  }

  const ROOT_GROUP_KEY = '\u0000root';
  const titleId = createId('notes-title');
  const focusableSelector = [
    'input:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'a[href]',
  ].join(',');
  const folderColorOptions: Array<{ id: NoteFolderColor; label: string }> = [
    { id: 'neutral', label: 'Varsayılan' },
    { id: 'blue', label: 'Mavi' },
    { id: 'purple', label: 'Mor' },
    { id: 'pink', label: 'Pembe' },
    { id: 'red', label: 'Kırmızı' },
    { id: 'orange', label: 'Turuncu' },
    { id: 'yellow', label: 'Sarı' },
    { id: 'green', label: 'Yeşil' },
  ];

  let panel: HTMLElement;
  let editor: HTMLTextAreaElement;
  let categoryInput: HTMLInputElement;
  let renameCategoryInput: HTMLInputElement;
  let renameNoteInput: HTMLInputElement;
  let directoryHandle: FileSystemDirectoryHandle | null = null;
  let repository: DirectoryNotesRepository | null = null;
  let connectionState: NotesConnectionState = 'loading';
  let rootName = '';
  let categories: NoteCategory[] = [];
  let notesByCategory = new Map<string, NoteSummary[]>();
  let expandedGroups = new Set<string>();
  let selectedCategory: string | null = null;
  let activeDocument: NoteDocument | null = null;
  let editorText = '';
  let savedText = '';
  let searchQuery = '';
  let saveState: SaveState = 'saved';
  let loadingTree = false;
  let operationBusy = false;
  let closing = false;
  let copied = false;
  let errorText = '';
  let noticeText = '';
  let legacyText = '';
  let migrationBusy = false;
  let recoveryDraft: NoteRecoveryDraft | null = null;
  let showRecoveryPrompt = false;
  let showOrphanRecovery = false;
  let recoveryResolved = true;
  let createMenuOpen = false;
  let detailsMenuOpen = false;
  let categoryMenu = '';
  let categoryCreating = false;
  let categoryDraft = '';
  let renamingCategory = '';
  let renameCategoryDraft = '';
  let renamingNoteRef: NoteRef | null = null;
  let renameNoteDraft = '';
  let folderColors: Record<string, NoteFolderColor> = {};
  let saveTimer: number | undefined;
  let recoveryTimer: number | undefined;
  let copyResetTimer: number | undefined;
  let noticeResetTimer: number | undefined;
  let lastRefreshAt = 0;
  let saveQueue: Promise<void> = Promise.resolve();
  let normalizedSearch = '';
  let treeGroups: TreeGroup[] = [];
  let visibleGroupCount = 0;
  const knownVersions = new Map<string, NoteVersion>();

  $: normalizedSearch = searchQuery.trim().toLocaleLowerCase('tr-TR');
  $: treeGroups = [
    { key: ROOT_GROUP_KEY, category: null, label: UNCATEGORIZED_LABEL },
    ...categories.map((category) => ({
      key: groupKey(category.name),
      category: category.name,
      label: category.name,
    })),
  ];
  $: visibleGroupCount = treeGroups.filter((group) => groupIsVisible(group)).length;
  $: isReadOnly = Boolean(activeDocument?.readOnlyReason);
  $: recoveryBlocking = Boolean(recoveryDraft && !recoveryResolved);
  $: selectedCategoryLabel = selectedCategory ?? UNCATEGORIZED_LABEL;

  onMount(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('focus', handleWindowFocus);
    void initialize().finally(async () => {
      await tick();
      if (panel && !panel.contains(document.activeElement)) {
        (panel.querySelector<HTMLElement>('[data-autofocus]')
          ?? panel.querySelector<HTMLElement>(focusableSelector))?.focus();
      }
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('focus', handleWindowFocus);
      previouslyFocused?.focus();
    };
  });

  onDestroy(() => {
    if (saveTimer) window.clearTimeout(saveTimer);
    if (recoveryTimer) window.clearTimeout(recoveryTimer);
    if (copyResetTimer) window.clearTimeout(copyResetTimer);
    if (noticeResetTimer) window.clearTimeout(noticeResetTimer);
    if (activeDocument && editorText !== savedText) void persistRecoveryNow();
  });

  function groupKey(category: string | null): string {
    return category ?? ROOT_GROUP_KEY;
  }

  function notesFor(category: string | null): NoteSummary[] {
    return notesByCategory.get(groupKey(category)) ?? [];
  }

  function filteredNotesFor(group: TreeGroup): NoteSummary[] {
    const notes = notesFor(group.category);
    if (!normalizedSearch || group.label.toLocaleLowerCase('tr-TR').includes(normalizedSearch)) {
      return notes;
    }
    return notes.filter((note) =>
      note.title.toLocaleLowerCase('tr-TR').includes(normalizedSearch));
  }

  function groupIsVisible(group: TreeGroup): boolean {
    if (!normalizedSearch) return true;
    return group.label.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
      || filteredNotesFor(group).length > 0;
  }

  function groupIsExpanded(group: TreeGroup): boolean {
    return Boolean(normalizedSearch) || expandedGroups.has(group.key);
  }

  function folderColor(category: string | null): NoteFolderColor {
    return category ? folderColors[category] ?? 'neutral' : 'neutral';
  }

  function firstNote(): NoteSummary | null {
    const rootNote = notesFor(null)[0];
    if (rootNote) return rootNote;
    for (const category of categories) {
      const note = notesFor(category.name)[0];
      if (note) return note;
    }
    return null;
  }

  function findNote(ref: NoteRef | null): NoteSummary | null {
    if (!ref) return null;
    return notesFor(ref.category).find((note) => sameNoteRef(note.ref, ref)) ?? null;
  }

  function hasAnyNotes(): boolean {
    for (const notes of notesByCategory.values()) {
      if (notes.length) return true;
    }
    return false;
  }

  function categoryExists(category: string | null): boolean {
    return category === null || categories.some((item) => item.name === category);
  }

  function messageForError(error: unknown, fallback: string): string {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') return 'Klasöre erişim izni verilmedi.';
      if (error.name === 'NotFoundError') return 'Not veya klasör artık bulunamıyor.';
      if (error.name === 'NoModificationAllowedError') return 'Klasör şu anda yazmaya izin vermiyor.';
    }
    return error instanceof Error && error.message ? error.message : fallback;
  }

  function reportError(error: unknown, fallback: string) {
    errorText = messageForError(error, fallback);
  }

  function showNotice(message: string) {
    noticeText = message;
    if (noticeResetTimer) window.clearTimeout(noticeResetTimer);
    noticeResetTimer = window.setTimeout(() => { noticeText = ''; }, 2_600);
  }

  function closeMenus() {
    createMenuOpen = false;
    detailsMenuOpen = false;
    categoryMenu = '';
  }

  function toggleCreateMenu(event: MouseEvent) {
    event.stopPropagation();
    const next = !createMenuOpen;
    closeMenus();
    createMenuOpen = next;
  }

  function toggleDetailsMenu(event: MouseEvent) {
    event.stopPropagation();
    const next = !detailsMenuOpen;
    closeMenus();
    detailsMenuOpen = next;
  }

  function toggleCategoryMenu(event: MouseEvent, category: string) {
    event.stopPropagation();
    const next = categoryMenu === category ? '' : category;
    closeMenus();
    categoryMenu = next;
    selectedCategory = category;
    void updateNotesUiState({ lastCategory: category }).catch(() => undefined);
  }

  async function initialize() {
    if (!supportsNotesDirectoryAccess()) {
      connectionState = 'unsupported';
      return;
    }

    try {
      const handle = await loadNotesDirectoryHandle();
      if (!handle) {
        connectionState = 'disconnected';
        return;
      }
      directoryHandle = handle;
      rootName = handle.name;
      const permission = await queryNotesDirectoryPermission(handle);
      if (permission !== 'granted') {
        connectionState = 'permission-needed';
        return;
      }
      await activateDirectory(handle);
    } catch (error) {
      connectionState = 'unavailable';
      reportError(error, 'Not klasörüne ulaşılamadı.');
    }
  }

  async function loadTreeData(
    snapshot?: NotesWorkspaceSnapshot,
  ): Promise<NotesWorkspaceSnapshot> {
    if (!repository) throw new Error('Not klasörü bağlı değil.');
    const previousKeys = new Set(notesByCategory.keys());
    const workspace = snapshot ?? await repository.snapshot();
    const categoryNotes = await Promise.all(
      workspace.categories.map(async (category) => [
        groupKey(category.name),
        await repository!.listNotes(category.name),
      ] as const),
    );
    const nextNotes = new Map<string, NoteSummary[]>();
    nextNotes.set(ROOT_GROUP_KEY, workspace.uncategorizedNotes);
    for (const [key, notes] of categoryNotes) nextNotes.set(key, notes);

    categories = workspace.categories;
    notesByCategory = nextNotes;

    const validKeys = new Set(nextNotes.keys());
    const nextExpanded = new Set(
      [...expandedGroups].filter((key) => validKeys.has(key)),
    );
    for (const key of validKeys) {
      if (!previousKeys.size || !previousKeys.has(key)) nextExpanded.add(key);
    }
    expandedGroups = nextExpanded;
    return workspace;
  }

  async function activateDirectory(handle: FileSystemDirectoryHandle) {
    directoryHandle = handle;
    rootName = handle.name;
    repository = new DirectoryNotesRepository(handle);
    connectionState = 'loading';
    errorText = '';
    loadingTree = true;

    try {
      const [snapshot, uiState, oldText, storedRecovery] = await Promise.all([
        repository.snapshot(),
        loadNotesUiState(),
        loadScratchpadText(),
        loadNoteRecoveryDraft(),
      ]);
      folderColors = uiState.folderColors;
      await loadTreeData(snapshot);
      legacyText = uiState.migrationVersion < 1 ? oldText : '';
      recoveryDraft = storedRecovery;
      recoveryResolved = !storedRecovery;

      const preferredRef = storedRecovery
        ? { category: storedRecovery.category, fileName: storedRecovery.fileName }
        : uiState.lastNote;
      const preferredCategory = preferredRef && categoryExists(preferredRef.category)
        ? preferredRef.category
        : categoryExists(uiState.lastCategory)
          ? uiState.lastCategory
          : null;
      const next = findNote(preferredRef) ?? firstNote();

      selectedCategory = preferredCategory;
      connectionState = 'ready';
      onPresenceChange(snapshot.hasNotes);
      await updateNotesUiState({
        hasNotes: snapshot.hasNotes,
        migrationVersion: uiState.migrationVersion < 1 && !oldText
          ? 1
          : uiState.migrationVersion,
      });

      if (next) await loadDocument(next, false);
      else clearActiveDocument();

      if (storedRecovery && activeDocument && sameNoteRef(activeDocument.ref, storedRecovery)) {
        showRecoveryPrompt = storedRecovery.text !== activeDocument.text;
        if (!showRecoveryPrompt) {
          recoveryDraft = null;
          recoveryResolved = true;
          await clearNoteRecoveryDraft();
        }
      } else if (storedRecovery) {
        showOrphanRecovery = true;
      }
    } catch (error) {
      connectionState = 'unavailable';
      reportError(error, 'Not klasörü okunamadı.');
    } finally {
      loadingTree = false;
    }
  }

  async function chooseDirectory() {
    if (operationBusy) return;
    if (requireRecoveryDecision()) return;
    operationBusy = true;
    closeMenus();
    errorText = '';
    try {
      const handle = await pickNotesDirectory();
      if (!handle) return;
      if (!await flushCurrent()) return;
      await saveNotesDirectoryHandle(handle);
      notesByCategory = new Map();
      expandedGroups = new Set();
      await activateDirectory(handle);
    } catch (error) {
      reportError(error, 'Not klasörü seçilemedi.');
      if (!directoryHandle) connectionState = 'disconnected';
    } finally {
      operationBusy = false;
    }
  }

  async function reconnectDirectory() {
    if (operationBusy) return;
    if (!directoryHandle) {
      connectionState = 'loading';
      await initialize();
      return;
    }
    operationBusy = true;
    errorText = '';
    try {
      const permission = await requestNotesDirectoryPermission(directoryHandle);
      if (permission === 'granted') await activateDirectory(directoryHandle);
      else connectionState = 'permission-needed';
    } catch (error) {
      reportError(error, 'Klasör izni alınamadı.');
    } finally {
      operationBusy = false;
    }
  }

  async function disconnectDirectory() {
    if (operationBusy) return;
    if (requireRecoveryDecision()) return;
    if (!await flushCurrent()) return;
    operationBusy = true;
    closeMenus();
    try {
      await clearNotesDirectoryHandle();
      await clearNoteRecoveryDraft();
      directoryHandle = null;
      repository = null;
      rootName = '';
      categories = [];
      notesByCategory = new Map();
      expandedGroups = new Set();
      selectedCategory = null;
      clearActiveDocument();
      recoveryDraft = null;
      recoveryResolved = true;
      connectionState = 'disconnected';
      onPresenceChange(false);
      await updateNotesUiState({ hasNotes: false, lastNote: null, lastCategory: null });
    } catch (error) {
      reportError(error, 'Klasör bağlantısı kaldırılamadı.');
    } finally {
      operationBusy = false;
    }
  }

  async function loadDocument(note: NoteSummary, focusEditor = true) {
    if (!repository) return;
    loadingTree = true;
    try {
      const document = await repository.readNote(note.ref);
      activeDocument = document;
      editorText = document.text;
      savedText = document.text;
      saveState = 'saved';
      selectedCategory = document.ref.category;
      const nextExpanded = new Set(expandedGroups);
      nextExpanded.add(groupKey(document.ref.category));
      expandedGroups = nextExpanded;
      knownVersions.set(noteRefKey(document.ref), document.version);
      await updateNotesUiState({ lastNote: document.ref, lastCategory: document.ref.category });
      await tick();
      if (focusEditor && !document.readOnlyReason) editor?.focus();
    } catch (error) {
      reportError(error, 'Not açılamadı.');
      throw error;
    } finally {
      loadingTree = false;
    }
  }

  function clearActiveDocument() {
    activeDocument = null;
    editorText = '';
    savedText = '';
    saveState = 'saved';
    showRecoveryPrompt = false;
  }

  function toggleGroup(group: TreeGroup) {
    closeMenus();
    selectedCategory = group.category;
    const next = new Set(expandedGroups);
    if (next.has(group.key)) next.delete(group.key);
    else next.add(group.key);
    expandedGroups = next;
    void updateNotesUiState({ lastCategory: group.category }).catch(() => undefined);
  }

  async function selectNote(note: NoteSummary) {
    closeMenus();
    if (sameNoteRef(activeDocument?.ref ?? null, note.ref) || operationBusy) return;
    if (requireRecoveryDecision()) return;
    if (renamingNoteRef && !await commitNoteRename()) return;
    if (!await flushCurrent()) return;
    await loadDocument(note);
  }

  function scheduleSave() {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      void persistCurrent();
    }, 400);
  }

  function scheduleRecovery() {
    if (recoveryTimer) window.clearTimeout(recoveryTimer);
    recoveryTimer = window.setTimeout(() => {
      recoveryTimer = undefined;
      void persistRecoveryNow();
    }, 180);
  }

  async function persistRecoveryNow() {
    if (recoveryTimer) window.clearTimeout(recoveryTimer);
    recoveryTimer = undefined;
    if (!activeDocument || editorText === savedText) return;
    const draft: NoteRecoveryDraft = {
      category: activeDocument.ref.category,
      fileName: activeDocument.ref.fileName,
      text: editorText,
      baseHash: knownVersions.get(noteRefKey(activeDocument.ref))?.hash
        ?? activeDocument.version.hash,
      updatedAt: Date.now(),
    };
    recoveryDraft = draft;
    recoveryResolved = true;
    await saveNoteRecoveryDraft(draft).catch(() => undefined);
  }

  function handleEditorInput(event: Event) {
    if (!activeDocument || isReadOnly) return;
    editorText = normalizeNoteText((event.currentTarget as HTMLTextAreaElement).value);
    scheduleRecovery();
    if (saveState === 'conflict') return;
    saveState = 'saving';
    scheduleSave();
  }

  async function persistCurrent(overwrite = false): Promise<boolean> {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = undefined;
    if (!repository || !activeDocument || isReadOnly) return true;
    if (editorText === savedText && saveState !== 'conflict') {
      saveState = 'saved';
      return true;
    }

    const ref = { ...activeDocument.ref };
    const snapshot = editorText;
    const key = noteRefKey(ref);
    const fallbackVersion = activeDocument.version;
    const notesRepository = repository;
    saveState = 'saving';

    const saveOperation = saveQueue.then(async () => {
      const expectedVersion = knownVersions.get(key) ?? fallbackVersion;
      const document = await notesRepository.saveNote(ref, snapshot, expectedVersion, overwrite);
      knownVersions.set(key, document.version);
      return document;
    });
    const settled = saveOperation.then(
      (document) => ({ document, error: null }),
      (error: unknown) => ({ document: null, error }),
    );
    saveQueue = settled.then(() => undefined);
    const { document: savedDocument, error: operationError } = await settled;

    if (operationError) {
      if (operationError instanceof NotesConflictError) {
        saveState = 'conflict';
        await persistRecoveryNow();
        return false;
      }
      saveState = 'error';
      reportError(operationError, 'Not kaydedilemedi.');
      await persistRecoveryNow();
      return false;
    }

    if (savedDocument && activeDocument && sameNoteRef(activeDocument.ref, ref)) {
      activeDocument = { ...savedDocument, text: editorText };
      savedText = snapshot;
      if (editorText === snapshot) {
        saveState = 'saved';
        recoveryDraft = null;
        showRecoveryPrompt = false;
        await clearNoteRecoveryDraft().catch(() => undefined);
      } else {
        saveState = 'saving';
        scheduleSave();
        scheduleRecovery();
      }
    }
    return true;
  }

  async function flushCurrent(): Promise<boolean> {
    return persistCurrent();
  }

  async function refreshGroup(category: string | null): Promise<NoteSummary[]> {
    if (!repository) return [];
    const notes = await repository.listNotes(category);
    const next = new Map(notesByCategory);
    next.set(groupKey(category), notes);
    notesByCategory = next;
    return notes;
  }

  async function createNote() {
    closeMenus();
    if (requireRecoveryDecision()) return;
    if (!repository || operationBusy || !await flushCurrent()) return;
    operationBusy = true;
    errorText = '';
    const category = categoryExists(selectedCategory) ? selectedCategory : null;
    try {
      const document = await repository.createNote(category);
      await refreshGroup(category);
      const nextExpanded = new Set(expandedGroups);
      nextExpanded.add(groupKey(category));
      expandedGroups = nextExpanded;
      selectedCategory = category;
      onPresenceChange(true);
      await updateNotesUiState({ hasNotes: true });
      await loadDocument(document, false);
      operationBusy = false;
      beginNoteRename(document);
    } catch (error) {
      reportError(error, 'Yeni not oluşturulamadı.');
    } finally {
      operationBusy = false;
    }
  }

  function beginCategoryCreate() {
    if (requireRecoveryDecision()) return;
    closeMenus();
    searchQuery = '';
    categoryCreating = true;
    categoryDraft = '';
    void tick().then(() => categoryInput?.focus());
  }

  function cancelCategoryCreate() {
    categoryCreating = false;
    categoryDraft = '';
  }

  async function createCategory() {
    if (requireRecoveryDecision()) return;
    if (!repository || operationBusy) return;
    const draft = categoryDraft.trim();
    if (!draft) {
      cancelCategoryCreate();
      return;
    }
    if (!await flushCurrent()) return;
    operationBusy = true;
    try {
      const category = await repository.createCategory(draft);
      categories = await repository.listCategories();
      const nextNotes = new Map(notesByCategory);
      nextNotes.set(groupKey(category.name), []);
      notesByCategory = nextNotes;
      const nextExpanded = new Set(expandedGroups);
      nextExpanded.add(groupKey(category.name));
      expandedGroups = nextExpanded;
      selectedCategory = category.name;
      categoryCreating = false;
      categoryDraft = '';
      await updateNotesUiState({ lastCategory: category.name });
    } catch (error) {
      reportError(error, 'Klasör oluşturulamadı.');
    } finally {
      operationBusy = false;
    }
  }

  function beginCategoryRename(category: string) {
    if (requireRecoveryDecision() || operationBusy) return;
    closeMenus();
    renamingCategory = category;
    renameCategoryDraft = category;
    void tick().then(() => {
      renameCategoryInput?.focus();
      renameCategoryInput?.select();
    });
  }

  function cancelCategoryRename() {
    renamingCategory = '';
    renameCategoryDraft = '';
  }

  async function commitCategoryRename(): Promise<boolean> {
    if (requireRecoveryDecision()) return false;
    if (!repository || operationBusy || !renamingCategory) return false;
    const source = renamingCategory;
    const draft = renameCategoryDraft.trim();
    if (!draft || draft === source) {
      cancelCategoryRename();
      return true;
    }
    if (!await flushCurrent()) return false;
    operationBusy = true;
    try {
      const previousActiveRef = activeDocument?.ref ?? null;
      const category = await repository.renameCategory(source, draft);
      cancelCategoryRename();

      const nextColors = { ...folderColors };
      const previousColor = nextColors[source];
      delete nextColors[source];
      if (previousColor) nextColors[category.name] = previousColor;
      folderColors = nextColors;

      const nextExpanded = new Set(expandedGroups);
      nextExpanded.delete(groupKey(source));
      nextExpanded.add(groupKey(category.name));
      expandedGroups = nextExpanded;
      if (selectedCategory === source) selectedCategory = category.name;

      await loadTreeData();
      const nextActiveRef = previousActiveRef?.category === source
        ? { ...previousActiveRef, category: category.name }
        : previousActiveRef;
      const nextActive = findNote(nextActiveRef);
      if (nextActive) await loadDocument(nextActive, false);

      await updateNotesUiState({
        folderColors,
        lastCategory: selectedCategory,
        lastNote: nextActive?.ref ?? activeDocument?.ref ?? null,
      }).catch((error) => reportError(error, 'Klasör rengi tercihi kaydedilemedi.'));
    } catch (error) {
      reportError(error, 'Klasör yeniden adlandırılamadı.');
      return false;
    } finally {
      operationBusy = false;
    }
    return true;
  }

  async function removeCategory(category: string) {
    closeMenus();
    if (requireRecoveryDecision()) return;
    if (!repository || operationBusy || !await flushCurrent()) return;
    operationBusy = true;
    try {
      await repository.removeEmptyCategory(category);
      if (selectedCategory === category) selectedCategory = null;
      await loadTreeData();
      const nextColors = { ...folderColors };
      delete nextColors[category];
      folderColors = nextColors;
      await updateNotesUiState({ folderColors, lastCategory: selectedCategory });
      showNotice('Boş klasör kaldırıldı.');
    } catch (error) {
      reportError(error, 'Klasör kaldırılamadı.');
    } finally {
      operationBusy = false;
    }
  }

  function setFolderColor(category: string, color: NoteFolderColor) {
    const next = { ...folderColors };
    if (color === 'neutral') delete next[category];
    else next[category] = color;
    folderColors = next;
    categoryMenu = '';
    void updateNotesUiState({ folderColors: next })
      .catch((error) => reportError(error, 'Klasör rengi kaydedilemedi.'));
  }

  function beginNoteRename(note: NoteSummary) {
    if (requireRecoveryDecision() || operationBusy) return;
    closeMenus();
    renamingNoteRef = { ...note.ref };
    renameNoteDraft = note.title;
    void tick().then(() => {
      renameNoteInput?.focus();
      renameNoteInput?.select();
    });
  }

  function cancelNoteRename() {
    renamingNoteRef = null;
    renameNoteDraft = '';
  }

  async function commitNoteRename(): Promise<boolean> {
    if (requireRecoveryDecision()) return false;
    if (!repository || operationBusy || !renamingNoteRef) return false;
    const source = { ...renamingNoteRef };
    const original = notesFor(source.category).find((note) => sameNoteRef(note.ref, source));
    const draft = renameNoteDraft.trim();
    if (!draft || draft === original?.title) {
      cancelNoteRename();
      if (sameNoteRef(activeDocument?.ref ?? null, source)) editor?.focus();
      return true;
    }
    if (!await flushCurrent()) return false;
    operationBusy = true;
    try {
      const wasActive = sameNoteRef(activeDocument?.ref ?? null, source);
      const renamed = await repository.renameNote(source, draft);
      knownVersions.delete(noteRefKey(source));
      knownVersions.set(noteRefKey(renamed.ref), renamed.version);
      cancelNoteRename();
      await refreshGroup(source.category);
      if (wasActive) {
        activeDocument = renamed;
        editorText = renamed.text;
        savedText = renamed.text;
        saveState = 'saved';
        await tick();
        editor?.focus();
      }
      await updateNotesUiState({
        lastNote: wasActive ? renamed.ref : activeDocument?.ref ?? null,
        lastCategory: selectedCategory,
      });
    } catch (error) {
      reportError(error, 'Notun adı değiştirilemedi.');
      return false;
    } finally {
      operationBusy = false;
    }
    return true;
  }

  async function trashNote(note: NoteSummary) {
    closeMenus();
    if (requireRecoveryDecision()) return;
    if (!repository || operationBusy || !await flushCurrent()) return;
    operationBusy = true;
    const wasActive = sameNoteRef(activeDocument?.ref ?? null, note.ref);
    try {
      await repository.trashNote(note.ref);
      knownVersions.delete(noteRefKey(note.ref));
      await refreshGroup(note.ref.category);

      let next: NoteSummary | null = null;
      if (wasActive) {
        await clearNoteRecoveryDraft().catch(() => undefined);
        recoveryDraft = null;
        next = notesFor(note.ref.category)[0] ?? firstNote();
        if (next) await loadDocument(next, false);
        else clearActiveDocument();
      }

      const hasNotes = hasAnyNotes();
      onPresenceChange(hasNotes);
      await updateNotesUiState({
        hasNotes,
        lastNote: wasActive ? next?.ref ?? null : activeDocument?.ref ?? null,
      });
      showNotice('Not çöp kutusuna taşındı.');
    } catch (error) {
      reportError(error, 'Not çöp kutusuna taşınamadı.');
    } finally {
      operationBusy = false;
    }
  }

  async function refreshWorkspace(showErrors = true) {
    closeMenus();
    if (!repository || connectionState !== 'ready' || operationBusy) return;
    if (requireRecoveryDecision()) return;
    const now = Date.now();
    if (!showErrors && now - lastRefreshAt < 1_000) return;
    lastRefreshAt = now;
    if (!await flushCurrent()) return;
    operationBusy = true;
    loadingTree = true;
    try {
      const activeRef = activeDocument?.ref ?? null;
      const snapshot = await loadTreeData();
      if (!categoryExists(selectedCategory)) selectedCategory = null;
      const current = findNote(activeRef);
      const next = current ?? firstNote();
      if (next) await loadDocument(next, false);
      else clearActiveDocument();
      onPresenceChange(snapshot.hasNotes);
      await updateNotesUiState({
        hasNotes: snapshot.hasNotes,
        lastCategory: selectedCategory,
        lastNote: next?.ref ?? null,
      });
      if (showErrors) showNotice('Klasör yenilendi.');
    } catch (error) {
      if (showErrors) reportError(error, 'Not klasörü yenilenemedi.');
    } finally {
      operationBusy = false;
      loadingTree = false;
    }
  }

  function handleWindowFocus() {
    if (connectionState === 'ready' && !operationBusy) void refreshWorkspace(false);
  }

  async function migrateLegacyText() {
    if (requireRecoveryDecision()) return;
    if (!repository || !legacyText || migrationBusy) return;
    migrationBusy = true;
    errorText = '';
    try {
      const document = await repository.createNote(null, 'Eski metin alanı', legacyText);
      await clearScratchpadText();
      await refreshGroup(null);
      await updateNotesUiState({ migrationVersion: 1, hasNotes: true });
      legacyText = '';
      selectedCategory = null;
      const nextExpanded = new Set(expandedGroups);
      nextExpanded.add(ROOT_GROUP_KEY);
      expandedGroups = nextExpanded;
      onPresenceChange(true);
      await loadDocument(document);
      showNotice('Eski metnin notlara aktarıldı.');
    } catch (error) {
      reportError(error, 'Eski metin aktarılamadı.');
    } finally {
      migrationBusy = false;
    }
  }

  async function restoreRecovery() {
    if (!recoveryDraft || !activeDocument) return;
    editorText = recoveryDraft.text;
    showRecoveryPrompt = false;
    showOrphanRecovery = false;
    recoveryResolved = true;
    saveState = 'saving';
    scheduleRecovery();
    scheduleSave();
    await tick();
    editor?.focus();
  }

  async function discardRecovery() {
    recoveryDraft = null;
    showRecoveryPrompt = false;
    showOrphanRecovery = false;
    recoveryResolved = true;
    await clearNoteRecoveryDraft().catch(() => undefined);
  }

  async function saveOrphanRecoveryCopy() {
    if (!repository || !recoveryDraft || operationBusy) return;
    operationBusy = true;
    try {
      const category = categoryExists(recoveryDraft.category) ? recoveryDraft.category : null;
      const document = await repository.createNote(
        category,
        `${noteTitleFromFileName(recoveryDraft.fileName)} kurtarılan`,
        recoveryDraft.text,
      );
      recoveryResolved = true;
      showOrphanRecovery = false;
      selectedCategory = category;
      await refreshGroup(category);
      await loadDocument(document);
      await discardRecovery();
      onPresenceChange(true);
      await updateNotesUiState({ hasNotes: true });
      showNotice('Kurtarılan taslak yeni bir nota kaydedildi.');
    } catch (error) {
      reportError(error, 'Kurtarma taslağı kaydedilemedi.');
    } finally {
      operationBusy = false;
    }
  }

  function requireRecoveryDecision(): boolean {
    if (!recoveryBlocking) return false;
    errorText = 'Devam etmeden önce kaydedilmemiş taslağı geri yükleyin veya silin.';
    return true;
  }

  async function reloadConflict() {
    if (!repository || !activeDocument) return;
    try {
      const document = await repository.readNote(activeDocument.ref);
      activeDocument = document;
      editorText = document.text;
      savedText = document.text;
      knownVersions.set(noteRefKey(document.ref), document.version);
      saveState = 'saved';
      await discardRecovery();
    } catch (error) {
      reportError(error, 'Diskteki sürüm yüklenemedi.');
    }
  }

  async function overwriteConflict() {
    saveState = 'saving';
    await persistCurrent(true);
  }

  async function saveConflictCopy() {
    if (!repository || !activeDocument || operationBusy) return;
    operationBusy = true;
    try {
      const copy = await repository.createNote(
        activeDocument.ref.category,
        `${activeDocument.title} kopya`,
        editorText,
      );
      await refreshGroup(activeDocument.ref.category);
      await loadDocument(copy);
      await discardRecovery();
      onPresenceChange(true);
      await updateNotesUiState({ hasNotes: true });
      showNotice('Değişikliklerin yeni bir nota kaydedildi.');
    } catch (error) {
      reportError(error, 'Not kopyası oluşturulamadı.');
    } finally {
      operationBusy = false;
    }
  }

  async function copyText() {
    if (!editorText) return;
    try {
      await navigator.clipboard.writeText(editorText);
    } catch (clipboardError) {
      if (!editor) {
        reportError(clipboardError, 'Metin kopyalanamadı.');
        return;
      }
      const selectionStart = editor.selectionStart;
      const selectionEnd = editor.selectionEnd;
      editor.focus();
      editor.select();
      const didCopy = document.execCommand('copy');
      editor.setSelectionRange(selectionStart, selectionEnd);
      if (!didCopy) {
        reportError(clipboardError, 'Metin kopyalanamadı.');
        return;
      }
    }
    copied = true;
    if (copyResetTimer) window.clearTimeout(copyResetTimer);
    copyResetTimer = window.setTimeout(() => { copied = false; }, 1_600);
  }

  async function requestClose() {
    if (closing) return;
    closing = true;
    const saved = await flushCurrent();
    if (!saved) await persistRecoveryNow();
    onClose();
  }

  function handleBackdrop(event: MouseEvent) {
    closeMenus();
    if (event.target === event.currentTarget) void requestClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (createMenuOpen || detailsMenuOpen || categoryMenu) {
        closeMenus();
        return;
      }
      if (categoryCreating) {
        cancelCategoryCreate();
        return;
      }
      if (renamingNoteRef) {
        cancelNoteRename();
        return;
      }
      if (renamingCategory) {
        cancelCategoryRename();
        return;
      }
      void requestClose();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase('tr-TR') === 's') {
      event.preventDefault();
      void persistCurrent();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase('tr-TR') === 'n') {
      event.preventDefault();
      void createNote();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter((element) => element.offsetParent !== null);
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="notes-backdrop" role="presentation" onclick={handleBackdrop}>
  <div
    bind:this={panel}
    class:notes-panel--setup={connectionState !== 'ready'}
    class="notes-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
  >
    <div class="notes-window-actions">
      {#if connectionState === 'ready'}
        <IconButton
          label={copied ? 'Kopyalandı' : 'Metni kopyala'}
          title={copied ? 'Kopyalandı' : 'Metni kopyala'}
          variant="ghost"
          class={copied ? 'copied' : ''}
          disabled={!activeDocument || !editorText}
          onclick={() => void copyText()}
        >
          <Icon name={copied ? 'check' : 'copy'} size={16} />
        </IconButton>
      {/if}
      <IconButton label="Kapat" variant="ghost" onclick={() => void requestClose()}>
        <Icon name="close" size={17} />
      </IconButton>
    </div>

    {#if errorText}
      <div class="notes-alert" role="alert">
        <Icon name="circle-alert" size={15} />
        <span>{errorText}</span>
        <button type="button" aria-label="Uyarıyı kapat" onclick={() => (errorText = '')}>
          <Icon name="close" size={14} />
        </button>
      </div>
    {/if}

    {#if noticeText}
      <div class="notes-toast" role="status">
        <Icon name="check" size={14} />
        <span>{noticeText}</span>
      </div>
    {/if}

    {#if connectionState !== 'ready'}
      <section class="notes-setup">
        <span class="notes-setup__icon" aria-hidden="true">
          <Icon name="folder-open" size={24} strokeWidth={1.55} />
        </span>

        {#if connectionState === 'loading'}
          <h2 id={titleId}>Not klasörü hazırlanıyor</h2>
          <p>Dosyaların ve erişim iznin kontrol ediliyor.</p>
        {:else if connectionState === 'disconnected'}
          <h2 id={titleId}>Not klasörünü bağla</h2>
          <p>Notların seçtiğin klasörde gerçek <strong>.txt</strong> dosyaları olarak kalır.</p>
          <Button data-autofocus disabled={operationBusy} onclick={() => void chooseDirectory()}>
            <Icon name="folder-open" size={16} />
            {operationBusy ? 'Klasör açılıyor…' : 'Klasör seç'}
          </Button>
          <small>Yalnızca seçtiğin klasöre erişilir.</small>
        {:else if connectionState === 'permission-needed'}
          <h2 id={titleId}>Klasöre yeniden bağlan</h2>
          <p><strong>{rootName}</strong> klasörü için erişim iznini yeniden onaylaman gerekiyor.</p>
          <div class="notes-setup__actions">
            <Button data-autofocus disabled={operationBusy} onclick={() => void reconnectDirectory()}>
              Erişimi ver
            </Button>
            <Button variant="outlined" disabled={operationBusy} onclick={() => void chooseDirectory()}>
              Başka klasör seç
            </Button>
          </div>
        {:else if connectionState === 'unavailable'}
          <h2 id={titleId}>Klasöre ulaşılamıyor</h2>
          <p>Klasör taşınmış, disk çıkarılmış veya bağlantı geçici olarak kesilmiş olabilir.</p>
          <div class="notes-setup__actions">
            <Button data-autofocus disabled={operationBusy} onclick={() => void reconnectDirectory()}>
              Tekrar dene
            </Button>
            <Button variant="outlined" disabled={operationBusy} onclick={() => void chooseDirectory()}>
              Başka klasör seç
            </Button>
          </div>
        {:else}
          <h2 id={titleId}>Bu tarayıcı desteklenmiyor</h2>
          <p>Yerel klasör bağlantısı için masaüstü bir Chromium tarayıcısı gerekiyor.</p>
        {/if}
      </section>
    {:else}
      <h2 id={titleId} class="visually-hidden">Not defteri</h2>
      <div class="notes-workspace">
        <aside class="notes-sidebar">
          <div class="notes-sidebar__toolbar">
            <label class="notes-search">
              <Icon name="search" size={14} />
              <input bind:value={searchQuery} type="search" placeholder="Notlarda ara" aria-label="Notlarda ara" />
              {#if searchQuery}
                <button type="button" aria-label="Aramayı temizle" onclick={() => (searchQuery = '')}>
                  <Icon name="close" size={13} />
                </button>
              {/if}
            </label>

            <div class="notes-create">
              <button
                type="button"
                class="notes-create__trigger"
                aria-label="Yeni öğe oluştur"
                title="Yeni öğe"
                aria-expanded={createMenuOpen}
                disabled={operationBusy}
                onclick={toggleCreateMenu}
              >
                <Icon name="plus" size={17} />
              </button>
              {#if createMenuOpen}
                <div class="notes-menu notes-create__menu">
                  <button type="button" onclick={() => void createNote()}>
                    <span><Icon name="file-plus" size={15} /></span>
                    <span>
                      <strong>Yeni not</strong>
                      <small>{selectedCategoryLabel}</small>
                    </span>
                  </button>
                  <button type="button" onclick={beginCategoryCreate}>
                    <span><Icon name="folder-plus" size={15} /></span>
                    <span>
                      <strong>Yeni klasör</strong>
                      <small>Notlarını grupla</small>
                    </span>
                  </button>
                </div>
              {/if}
            </div>
          </div>

          <div class="notes-tree-scroll">
            <nav class="notes-tree" aria-label="Not dosyaları">
              {#if loadingTree && !treeGroups.length}
                <p class="notes-tree__message">Notlar yükleniyor…</p>
              {:else}
                {#each treeGroups as group (group.key)}
                  {#if groupIsVisible(group)}
                    <div class="notes-tree-group">
                      {#if group.category && renamingCategory === group.category}
                        <form
                          class="notes-tree-folder notes-tree-folder--editing"
                          onsubmit={(event) => { event.preventDefault(); void commitCategoryRename(); }}
                        >
                          <span class="notes-tree-folder__chevron"><Icon name="chevron-down" size={13} /></span>
                          <span class="notes-folder-icon" data-folder-color={folderColor(group.category)}>
                            <Icon name="folder" size={15} />
                          </span>
                          <input
                            bind:this={renameCategoryInput}
                            bind:value={renameCategoryDraft}
                            maxlength="80"
                            aria-label="Klasör adı"
                            onblur={() => void commitCategoryRename()}
                          />
                        </form>
                      {:else}
                        <div
                          class:target={selectedCategory === group.category}
                          class="notes-tree-folder"
                        >
                          <button
                            type="button"
                            class="notes-tree-folder__main"
                            aria-expanded={groupIsExpanded(group)}
                            onclick={() => toggleGroup(group)}
                          >
                            <span class:expanded={groupIsExpanded(group)} class="notes-tree-folder__chevron">
                              <Icon name="arrow" size={13} />
                            </span>
                            <span class="notes-folder-icon" data-folder-color={folderColor(group.category)}>
                              <Icon name={groupIsExpanded(group) ? 'folder-open' : 'folder'} size={15} />
                            </span>
                            <span class="notes-tree-folder__name">{group.label}</span>
                            <span class="notes-tree-folder__count">{notesFor(group.category).length}</span>
                          </button>
                          {#if group.category}
                            <button
                              type="button"
                              class:open={categoryMenu === group.category}
                              class="notes-tree-folder__more"
                              aria-label={`${group.label} klasörünün ayrıntıları`}
                              title="Klasör ayrıntıları"
                              onclick={(event) => toggleCategoryMenu(event, group.category!)}
                            >
                              <Icon name="more" size={14} />
                            </button>
                          {/if}
                        </div>
                      {/if}

                      {#if group.category && categoryMenu === group.category}
                        <div class="notes-category-details">
                          <span class="notes-category-details__label">Klasör rengi</span>
                          <div class="notes-color-options">
                            {#each folderColorOptions as color (color.id)}
                              <button
                                type="button"
                                class:active={folderColor(group.category) === color.id}
                                data-folder-color={color.id}
                                aria-label={color.label}
                                title={color.label}
                                onclick={() => setFolderColor(group.category!, color.id)}
                              ><span></span></button>
                            {/each}
                          </div>
                          <div class="notes-category-details__actions">
                            <button type="button" onclick={() => beginCategoryRename(group.category!)}>
                              <Icon name="edit" size={14} /> Yeniden adlandır
                            </button>
                            <button
                              type="button"
                              class="danger"
                              disabled={notesFor(group.category).length > 0}
                              title={notesFor(group.category).length ? 'Yalnızca boş klasörler kaldırılabilir' : ''}
                              onclick={() => void removeCategory(group.category!)}
                            >
                              <Icon name="trash" size={14} /> Boş klasörü sil
                            </button>
                          </div>
                        </div>
                      {/if}

                      {#if groupIsExpanded(group)}
                        <div class="notes-tree-notes" role="group" aria-label={`${group.label} notları`}>
                          {#each filteredNotesFor(group) as note (noteRefKey(note.ref))}
                            {#if renamingNoteRef && sameNoteRef(renamingNoteRef, note.ref)}
                              <form
                                class="notes-tree-note notes-tree-note--editing"
                                onsubmit={(event) => { event.preventDefault(); void commitNoteRename(); }}
                              >
                                <Icon name="file" size={14} />
                                <input
                                  bind:this={renameNoteInput}
                                  bind:value={renameNoteDraft}
                                  maxlength="80"
                                  aria-label="Not adı"
                                  onblur={() => void commitNoteRename()}
                                />
                              </form>
                            {:else}
                              <div
                                class:active={sameNoteRef(activeDocument?.ref ?? null, note.ref)}
                                class="notes-tree-note"
                              >
                                <button
                                  type="button"
                                  class="notes-tree-note__main"
                                  onclick={() => void selectNote(note)}
                                >
                                  <Icon name="file" size={14} />
                                  <span>{note.title}</span>
                                  {#if sameNoteRef(activeDocument?.ref ?? null, note.ref) && saveState !== 'saved'}
                                    <i
                                      class:error={saveState === 'error' || saveState === 'conflict'}
                                      class:saving={saveState === 'saving'}
                                      class="notes-save-dot"
                                      title={saveState === 'saving' ? 'Kaydediliyor' : 'Kaydedilemedi'}
                                    ></i>
                                  {/if}
                                </button>
                                <span class="notes-tree-note__actions">
                                  <button
                                    type="button"
                                    aria-label={`${note.title} notunu yeniden adlandır`}
                                    title="Yeniden adlandır"
                                    onclick={() => beginNoteRename(note)}
                                  ><Icon name="edit" size={13} /></button>
                                  <button
                                    type="button"
                                    class="danger"
                                    aria-label={`${note.title} notunu çöp kutusuna taşı`}
                                    title="Çöp kutusuna taşı"
                                    onclick={() => void trashNote(note)}
                                  ><Icon name="trash" size={13} /></button>
                                </span>
                              </div>
                            {/if}
                          {:else}
                            {#if !normalizedSearch}
                              <span class="notes-tree-empty">Boş</span>
                            {/if}
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/if}
                {/each}
              {/if}

              {#if categoryCreating}
                <form
                  class="notes-tree-folder notes-tree-folder--editing notes-tree-folder--new"
                  onsubmit={(event) => { event.preventDefault(); void createCategory(); }}
                >
                  <span class="notes-tree-folder__chevron"></span>
                  <span class="notes-folder-icon" data-folder-color="neutral">
                    <Icon name="folder" size={15} />
                  </span>
                  <input
                    bind:this={categoryInput}
                    bind:value={categoryDraft}
                    maxlength="80"
                    placeholder="Klasör adı"
                    aria-label="Yeni klasör adı"
                    onblur={() => void createCategory()}
                  />
                </form>
              {/if}

              {#if normalizedSearch && visibleGroupCount === 0}
                <p class="notes-tree__message">Eşleşen not bulunamadı.</p>
              {/if}
            </nav>
          </div>

          <div class="notes-sidebar__footer">
            {#if detailsMenuOpen}
              <div class="notes-menu notes-folder-menu">
                <div class="notes-folder-menu__heading">
                  <span><Icon name="drive" size={15} /></span>
                  <span>
                    <strong>{rootName}</strong>
                    <small>Yerel not klasörü</small>
                  </span>
                </div>
                <button type="button" disabled={operationBusy} onclick={() => void refreshWorkspace()}>
                  <Icon name="refresh" size={14} /> Klasörü yenile
                </button>
                <button type="button" disabled={operationBusy} onclick={() => void chooseDirectory()}>
                  <Icon name="folder-open" size={14} /> Klasörü değiştir
                </button>
                <span class="notes-menu__separator"></span>
                <button class="danger" type="button" disabled={operationBusy} onclick={() => void disconnectDirectory()}>
                  <Icon name="close" size={14} /> Bağlantıyı ayır
                </button>
              </div>
            {/if}
            <button
              type="button"
              class="notes-folder-trigger"
              aria-expanded={detailsMenuOpen}
              onclick={toggleDetailsMenu}
            >
              <span class="notes-folder-trigger__icon"><Icon name="drive" size={15} /></span>
              <span class="notes-folder-trigger__text">
                <strong title={rootName}>{rootName}</strong>
                <small>Yerel klasör</small>
              </span>
              <Icon name="more" size={15} />
            </button>
          </div>
        </aside>

        <main class="notes-editor-shell">
          <div class="notes-editor-banners">
            {#if legacyText}
              <div class="notes-banner">
                <Icon name="file" size={15} />
                <span><strong>Eski metin alanında içeriğin var.</strong> Bir nota aktarabilirsin.</span>
                <Button size="sm" variant="ghost" disabled={migrationBusy} onclick={() => void migrateLegacyText()}>
                  {migrationBusy ? 'Aktarılıyor…' : 'Aktar'}
                </Button>
                <button type="button" aria-label="Şimdilik kapat" onclick={() => (legacyText = '')}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            {/if}

            {#if showRecoveryPrompt && recoveryDraft}
              <div class="notes-banner notes-banner--warning" role="status">
                <Icon name="circle-alert" size={15} />
                <span>Kaydedilmemiş bir taslak bulundu.</span>
                <Button size="sm" variant="ghost" tone="primary" onclick={() => void restoreRecovery()}>Geri yükle</Button>
                <Button size="sm" variant="ghost" onclick={() => void discardRecovery()}>Sil</Button>
              </div>
            {/if}

            {#if showOrphanRecovery && recoveryDraft}
              <div class="notes-banner notes-banner--warning" role="status">
                <Icon name="circle-alert" size={15} />
                <span>Taslağın bağlı olduğu dosya bulunamıyor.</span>
                <Button size="sm" variant="ghost" tone="primary" onclick={() => void saveOrphanRecoveryCopy()}>
                  Kopya kaydet
                </Button>
                <Button size="sm" variant="ghost" onclick={() => void discardRecovery()}>Sil</Button>
              </div>
            {/if}

            {#if saveState === 'conflict'}
              <div class="notes-banner notes-banner--conflict" role="alert">
                <Icon name="circle-alert" size={15} />
                <span><strong>Not başka bir uygulamada değişti.</strong></span>
                <Button size="sm" variant="ghost" onclick={() => void reloadConflict()}>Disktekini yükle</Button>
                <Button size="sm" variant="ghost" onclick={() => void saveConflictCopy()}>Kopya oluştur</Button>
                <Button size="sm" variant="outlined" tone="danger" onclick={() => void overwriteConflict()}>Üzerine yaz</Button>
              </div>
            {/if}
          </div>

          {#if activeDocument}
            {#if activeDocument.readOnlyReason}
              <div class="notes-readonly">
                <span><Icon name="circle-alert" size={20} /></span>
                <strong>
                  {activeDocument.readOnlyReason === 'too-large'
                    ? 'Bu dosya extension içinde düzenlemek için çok büyük.'
                    : 'Bu dosya UTF-8 biçiminde değil.'}
                </strong>
                <p>Dosyayı değiştirmeden koruyoruz. Bilgisayarındaki metin editörüyle açabilirsin.</p>
              </div>
            {:else}
              <textarea
                bind:this={editor}
                data-autofocus
                value={editorText}
                placeholder="Promptunu, fikrini veya notunu yaz…"
                aria-label={`${activeDocument.title} notunun içeriği`}
                spellcheck="false"
                disabled={recoveryBlocking}
                oninput={handleEditorInput}
              ></textarea>
            {/if}
          {:else}
            <div class="notes-empty-editor">
              <span><Icon name="file" size={22} strokeWidth={1.45} /></span>
              <h3>{normalizedSearch ? 'Bir not seç' : 'Yazmaya hazır'}</h3>
              <p>{selectedCategoryLabel} içinde yeni bir metin dosyası oluştur.</p>
              <Button data-autofocus variant="outlined" disabled={operationBusy} onclick={() => void createNote()}>
                <Icon name="file-plus" size={15} /> Yeni not
              </Button>
            </div>
          {/if}
        </main>
      </div>
    {/if}
  </div>
</div>

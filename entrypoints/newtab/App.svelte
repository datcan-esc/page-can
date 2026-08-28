<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import BookmarkCard from '../../components/bookmarks/BookmarkCard.svelte';
  import BookmarksDialog from '../../components/bookmarks/BookmarksDialog.svelte';
  import AppDrawer from '../../components/favorites/AppDrawer.svelte';
  import FolderAppDialog from '../../components/favorites/FolderAppDialog.svelte';
  import FavoriteDialog from '../../components/favorites/FavoriteDialog.svelte';
  import FavoriteGrid from '../../components/favorites/FavoriteGrid.svelte';
  import FocusCard from '../../components/focus/FocusCard.svelte';
  import FocusSettingsDialog from '../../components/focus/FocusSettingsDialog.svelte';
  import MediaPlayer from '../../components/media/MediaPlayer.svelte';
  import MediaSettingsDialog from '../../components/media/MediaSettingsDialog.svelte';
  import NotesDialog from '../../components/notes/NotesDialog.svelte';
  import SettingsDialog from '../../components/settings/SettingsDialog.svelte';
  import ClockCard from '../../components/shell/ClockCard.svelte';
  import StatsCard from '../../components/stats/StatsCard.svelte';
  import StatsDetailDialog from '../../components/stats/StatsDetailDialog.svelte';
  import TodoCard from '../../components/todos/TodoCard.svelte';
  import TodosDialog from '../../components/todos/TodosDialog.svelte';
  import Icon from '../../components/ui/Icon.svelte';
  import IconButton from '../../components/ui/IconButton.svelte';
  import { loadAllBookmarks, loadRecentBookmarks, removeBookmark } from '../../lib/bookmarks';
  import { DEFAULT_TIMER } from '../../lib/defaults';
  import { FAVORITE_CARD_LIMIT, FOLDER_APP_LIMIT } from '../../lib/display-limits';
  import {
    durationForMode,
    requestCompletion,
    requestTimerReconciliation,
    toggleTimer,
  } from '../../lib/pomodoro';
  import {
    NOTES_UI_STATE_KEY,
    loadNotesUiState,
    normalizeNotesUiState,
  } from '../../lib/note-preferences';
  import { setDailyFocusSeconds } from '../../lib/stats';
  import { cycleTodoTagFilter } from '../../lib/todos';
  import {
    loadActiveTodos,
    loadCompletedTodos,
    loadFavorites,
    loadSettings,
    loadStats,
    loadStatsRange,
    loadTimer,
    loadTodoTags,
    moveTodosToCompleted,
    normalizeSettings,
    saveActiveTodos,
    saveFavorites,
    saveSettings,
    saveTimer,
    saveTodoBuckets,
    statsInRange,
    storageKeys,
  } from '../../lib/storage';
  import { applyTheme } from '../../lib/theme';
  import type {
    AppSettings,
    BookmarkItem,
    DailyStat,
    Favorite,
    FavoriteFolder,
    FolderApp,
    MediaPreferences,
    PomodoroPreferences,
    PomodoroState,
    Todo,
    TodoTag,
  } from '../../lib/types';
  import {
    eventShortcut,
    localMonthRange,
    localWeekRange,
    moveItemById,
    singleKeyFromEvent,
  } from '../../lib/utils';
  import {
    analyzeWallpaper,
    getWallpaper,
    optimizeWallpaper,
    removeWallpaper,
    saveWallpaper,
  } from '../../lib/wallpaper';

  export let initialSettings: AppSettings;
  export let initialError = '';

  const TODO_FILTER_SHORTCUTS = ['Alt+ArrowLeft', 'Alt+ArrowRight'];

  type DialogName =
    | 'settings'
    | 'notes'
    | 'favorite'
    | 'folder-app'
    | 'bookmarks'
    | 'todos'
    | 'pomodoro'
    | 'media'
    | 'stats';

  let settings = initialSettings;
  let favorites: Favorite[] = [];
  let activeTodos: Todo[] = [];
  let completedTodos: Todo[] = [];
  let todoTags: TodoTag[] = [];
  let selectedTodoTagId = '';
  let todoFilterDirection = 1;
  let completedTodosLoaded = false;
  let timer: PomodoroState = { ...DEFAULT_TIMER };
  let weeklyStats: DailyStat[] = [];
  let monthlyStats: DailyStat[] = [];
  let monthlyStatsLoaded = false;
  let recentBookmarks: BookmarkItem[] = [];
  let allBookmarks: BookmarkItem[] = [];
  let bookmarksLoading = false;
  let todosLoading = false;
  let statsLoading = false;
  let bookmarksLoadVersion = 0;
  let todosLoadVersion = 0;
  let statsLoadVersion = 0;
  let todoOperationQueue: Promise<void> = Promise.resolve();
  let loaded = false;
  let appError = initialError;
  let activeDialog: DialogName | null = null;
  let editingFavorite: Favorite | null = null;
  let activeFolderId = '';
  let editingFolderId = '';
  let editingFolderApp: FolderApp | null = null;
  let wallpaperUrl = '';
  let hasWallpaper = false;
  let shortcutHintKeyHeld = false;
  let todoFocusRequest = 0;
  let todoRowsFocusRequest = 0;
  let clockInterval: number | undefined;
  let hasNotes = false;

  $: if (selectedTodoTagId && !todoTags.some((tag) => tag.id === selectedTodoTagId)) {
    selectedTodoTagId = '';
    todoFilterDirection = -1;
  }

  const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeFormatter = new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  let dateLabel = dateFormatter.format(new Date());
  let timeLabel = timeFormatter.format(new Date());

  $: activeFolder = favorites.find((item): item is FavoriteFolder =>
    item.kind === 'folder' && item.id === activeFolderId) ?? null;
  $: favoriteShortcuts = favorites.flatMap((favorite) =>
    favorite.shortcut ? [favorite.shortcut] : []);
  $: showShortcutHints = shortcutHintKeyHeld && !activeDialog;
  $: globalActionShortcuts = [
    settings.shortcuts.revealKey,
    settings.shortcuts.todoFocus,
    ...TODO_FILTER_SHORTCUTS,
  ].filter(Boolean);

  function updateClock() {
    const now = new Date();
    dateLabel = dateFormatter.format(now);
    timeLabel = timeFormatter.format(now);
  }

  function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  function reportError(error: unknown, fallback: string) {
    appError = errorMessage(error, fallback);
  }

  function selectTodoFilter(tagId: string, direction = 1) {
    selectedTodoTagId = tagId && todoTags.some((tag) => tag.id === tagId) ? tagId : '';
    todoFilterDirection = direction < 0 ? -1 : 1;
  }

  async function refreshRecentBookmarks() {
    recentBookmarks = await loadRecentBookmarks();
  }

  async function refreshAllBookmarks(version = bookmarksLoadVersion) {
    const bookmarks = await loadAllBookmarks();
    if (version === bookmarksLoadVersion && activeDialog === 'bookmarks') {
      allBookmarks = bookmarks;
    }
  }

  function handleBookmarksChanged() {
    void refreshRecentBookmarks().catch((error) => reportError(error, 'Yer imleri güncellenemedi.'));
    if (activeDialog === 'bookmarks') {
      void refreshAllBookmarks().catch((error) => reportError(error, 'Yer imleri güncellenemedi.'));
    }
  }

  async function refreshWallpaper() {
    const wallpaper = await getWallpaper();
    if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
    wallpaperUrl = wallpaper ? URL.createObjectURL(wallpaper) : '';
    hasWallpaper = Boolean(wallpaper);
  }

  async function updateFavorites(next: Favorite[]) {
    await saveFavorites(next);
    favorites = next;
  }

  function openFavoriteDialog(favorite: Favorite | null = null) {
    editingFavorite = favorite;
    activeDialog = 'favorite';
  }

  async function saveFavorite(favorite: Favorite) {
    const exists = favorites.some((item) => item.id === favorite.id);
    if (!exists && favorites.length >= FAVORITE_CARD_LIMIT) return;
    const next = exists
      ? favorites.map((item) => item.id === favorite.id ? favorite : item)
      : [...favorites, favorite];
    await updateFavorites(next);
  }

  async function deleteFavorite(favorite: Favorite) {
    try {
      await updateFavorites(favorites.filter((item) => item.id !== favorite.id));
      if (favorite.id === activeFolderId) activeFolderId = '';
    } catch (error) {
      reportError(error, 'Favori silinemedi.');
    }
  }

  async function reorderFavorites(sourceId: string, targetId: string) {
    const next = moveItemById(favorites, sourceId, targetId);
    if (next === favorites) return;
    try {
      await updateFavorites(next);
    } catch (error) {
      reportError(error, 'Favorilerin sırası kaydedilemedi.');
    }
  }

  function openAppDrawer(folder: FavoriteFolder) {
    activeFolderId = folder.id;
  }

  function openFolderAppDialog(folder: FavoriteFolder, app: FolderApp | null = null) {
    editingFolderId = folder.id;
    editingFolderApp = app;
    activeDialog = 'folder-app';
  }

  function closeFolderAppDialog() {
    activeDialog = null;
    editingFolderId = '';
    editingFolderApp = null;
  }

  async function saveFolderApp(app: FolderApp) {
    const folder = favorites.find((item): item is FavoriteFolder =>
      item.kind === 'folder' && item.id === editingFolderId);
    if (!folder) throw new Error('Uygulama klasörü bulunamadı.');

    const exists = folder.apps.some((item) => item.id === app.id);
    if (!exists && folder.apps.length >= FOLDER_APP_LIMIT) {
      throw new Error('Bir uygulama klasörüne en fazla 9 site eklenebilir.');
    }
    const apps = exists
      ? folder.apps.map((item) => item.id === app.id ? app : item)
      : [...folder.apps, app];
    await saveFavorite({ ...folder, apps });
  }

  async function deleteFolderApp(folder: FavoriteFolder, app: FolderApp) {
    try {
      await saveFavorite({
        ...folder,
        apps: folder.apps.filter((item) => item.id !== app.id),
      });
    } catch (error) {
      reportError(error, 'Uygulama klasörden silinemedi.');
    }
  }

  async function reorderFolderApps(folder: FavoriteFolder, sourceId: string, targetId: string) {
    const apps = moveItemById(folder.apps, sourceId, targetId);
    if (apps === folder.apps) return;
    try {
      await saveFavorite({ ...folder, apps });
    } catch (error) {
      reportError(error, 'Klasördeki uygulamaların sırası kaydedilemedi.');
    }
  }

  async function deleteBookmark(bookmark: BookmarkItem) {
    const previousRecent = recentBookmarks;
    const previousAll = allBookmarks;
    recentBookmarks = recentBookmarks.filter((item) => item.id !== bookmark.id);
    allBookmarks = allBookmarks.filter((item) => item.id !== bookmark.id);
    try {
      await removeBookmark(bookmark.id);
    } catch (error) {
      recentBookmarks = previousRecent;
      allBookmarks = previousAll;
      reportError(error, 'Yer imi silinemedi.');
    }
  }

  function queueTodoOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = todoOperationQueue.catch(() => undefined).then(operation);
    todoOperationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  function updateActiveTodos(next: Todo[], nextTags = todoTags): Promise<void> {
    return queueTodoOperation(async () => {
      const nextActive = next.filter((todo) => !todo.completed);
      const newlyCompleted = next.filter((todo) => todo.completed);
      if (newlyCompleted.length) {
        await moveTodosToCompleted(nextActive, newlyCompleted, nextTags);
        if (completedTodosLoaded) {
          const completedIds = new Set(newlyCompleted.map((todo) => todo.id));
          completedTodos = [
            ...completedTodos.filter((todo) => !completedIds.has(todo.id)),
            ...newlyCompleted,
          ];
        }
      } else {
        await saveActiveTodos(nextActive, nextTags);
      }
      activeTodos = nextActive;
      todoTags = nextTags;
    });
  }

  function updateAllTodos(next: Todo[], nextTags = todoTags): Promise<void> {
    return queueTodoOperation(async () => {
      const nextActive = next.filter((todo) => !todo.completed);
      const nextCompleted = next.filter((todo) => todo.completed);
      await saveTodoBuckets(nextActive, nextCompleted, nextTags);
      activeTodos = nextActive;
      completedTodos = nextCompleted;
      todoTags = nextTags;
    });
  }

  async function updateSettings(next: AppSettings) {
    const normalized = normalizeSettings(next);
    await saveSettings(normalized);
    settings = structuredClone(normalized);
    shortcutHintKeyHeld = false;
    applyTheme(settings.theme);

    if (timer.status === 'idle') {
      const durationSec = durationForMode(timer.mode, settings);
      timer = { ...timer, durationSec, remainingSec: durationSec };
      await saveTimer(timer);
    }
  }

  async function updatePomodoroPreferences(pomodoro: PomodoroPreferences) {
    await updateSettings({ ...settings, pomodoro });
  }

  async function updateMediaPreferences(media: MediaPreferences) {
    await updateSettings({ ...settings, media });
  }

  async function updateWallpaper(file: File) {
    if (!file.type.startsWith('image/')) throw new Error('Lütfen geçerli bir fotoğraf seçin.');
    if (file.size > 50 * 1024 * 1024) throw new Error('Fotoğraf 50 MB’tan küçük olmalı.');
    const { blob, analysis } = await optimizeWallpaper(file);
    await saveWallpaper(blob);
    await refreshWallpaper();
    if (settings.theme.autoAccent) {
      await updateSettings({
        ...settings,
        theme: { ...settings.theme, primaryColor: analysis.accentColor },
      });
    }
    return analysis;
  }

  async function analyzeCurrentWallpaper() {
    const wallpaper = await getWallpaper();
    return wallpaper ? analyzeWallpaper(wallpaper) : null;
  }

  async function clearWallpaper() {
    await removeWallpaper();
    await refreshWallpaper();
  }

  async function openBookmarksDialog() {
    activeDialog = 'bookmarks';
    bookmarksLoading = true;
    const version = ++bookmarksLoadVersion;
    try {
      await refreshAllBookmarks(version);
    } catch (error) {
      reportError(error, 'Tüm yer imleri yüklenemedi.');
    } finally {
      if (version === bookmarksLoadVersion) bookmarksLoading = false;
    }
  }

  function closeBookmarksDialog() {
    bookmarksLoadVersion += 1;
    bookmarksLoading = false;
    allBookmarks = [];
    activeDialog = null;
  }

  async function openTodosDialog(tagId = selectedTodoTagId) {
    selectTodoFilter(tagId, todoFilterDirection);
    activeDialog = 'todos';
    todosLoading = true;
    completedTodosLoaded = false;
    completedTodos = [];
    const version = ++todosLoadVersion;
    try {
      const loadedTodos = await queueTodoOperation(loadCompletedTodos);
      if (version === todosLoadVersion && activeDialog === 'todos') {
        completedTodos = loadedTodos;
        completedTodosLoaded = true;
      }
    } catch (error) {
      reportError(error, 'Tamamlanan görevler yüklenemedi.');
    } finally {
      if (version === todosLoadVersion) todosLoading = false;
    }
  }

  function closeTodosDialog() {
    todosLoadVersion += 1;
    todosLoading = false;
    completedTodosLoaded = false;
    completedTodos = [];
    activeDialog = null;
  }

  async function openStatsDialog() {
    activeDialog = 'stats';
    statsLoading = true;
    monthlyStatsLoaded = false;
    monthlyStats = [];
    const version = ++statsLoadVersion;
    try {
      const loadedStats = await loadStatsRange(localMonthRange());
      if (version === statsLoadVersion && activeDialog === 'stats') {
        monthlyStats = loadedStats;
        monthlyStatsLoaded = true;
      }
    } catch (error) {
      reportError(error, 'Aylık odak verileri yüklenemedi.');
    } finally {
      if (version === statsLoadVersion) statsLoading = false;
    }
  }

  async function updateStatsDay(date: string, focusSeconds: number) {
    await setDailyFocusSeconds(date, focusSeconds);
    const stats = await loadStats();
    weeklyStats = statsInRange(stats, localWeekRange());
    if (monthlyStatsLoaded) monthlyStats = statsInRange(stats, localMonthRange());
  }

  function closeStatsDialog() {
    statsLoadVersion += 1;
    statsLoading = false;
    monthlyStatsLoaded = false;
    monthlyStats = [];
    activeDialog = null;
  }

  async function handleShortcut(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (
      !loaded ||
      !timer ||
      target?.closest('input, textarea, select, [role="textbox"]') ||
      target?.isContentEditable ||
      event.isComposing ||
      event.repeat ||
      activeDialog ||
      activeFolderId
    ) return;

    const pressed = eventShortcut(event);
    if (pressed === 'Space' && target?.closest('button, a')) return;
    if (pressed === settings.shortcuts.todoFocus) {
      event.preventDefault();
      todoFocusRequest += 1;
      return;
    }

    if (pressed === settings.pomodoro.shortcut) {
      event.preventDefault();
      try {
        timer = await toggleTimer(timer, settings);
      } catch (error) {
        reportError(error, 'Odak sayacı güncellenemedi.');
      }
      return;
    }

    const favorite = favorites.find((item) =>
      Boolean(item.shortcut) && item.shortcut === pressed);
    if (favorite) {
      event.preventDefault();
      if (favorite.kind === 'folder') {
        openAppDrawer(favorite);
      } else {
        window.location.assign(favorite.url);
      }
    }
  }

  function isRevealKeydown(event: KeyboardEvent): boolean {
    const revealKey = settings.shortcuts.revealKey;
    const pressedKey = singleKeyFromEvent(event);
    if (!revealKey || pressedKey !== revealKey) return false;
    if (revealKey === 'Shift' || revealKey === 'Ctrl' || revealKey === 'Alt' || revealKey === 'Meta') {
      return true;
    }
    return !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
  }

  function handleTodoFilterShortcut(event: KeyboardEvent, isTextEntry: boolean): boolean {
    if (
      !loaded
      || isTextEntry
      || event.isComposing
      || !event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
      || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
      || (activeDialog && activeDialog !== 'todos')
      || activeFolderId
      || todoTags.length === 0
    ) return false;

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextTagId = cycleTodoTagFilter(todoTags, selectedTodoTagId, direction);
    event.preventDefault();
    selectTodoFilter(nextTagId, direction);
    const focusRequest = todoRowsFocusRequest + 1;
    todoRowsFocusRequest = focusRequest;
    window.setTimeout(() => {
      if (todoRowsFocusRequest === focusRequest) todoRowsFocusRequest = 0;
    }, 0);
    return true;
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    const isTextEntry = Boolean(
      target?.closest('input, textarea, select, [role="textbox"]')
      || target?.isContentEditable,
    );
    if (handleTodoFilterShortcut(event, isTextEntry)) return;
    const revealKeyIsModifier = ['Shift', 'Ctrl', 'Alt', 'Meta']
      .includes(settings.shortcuts.revealKey);
    const canRevealHints = (!activeDialog || activeDialog === 'todos')
      && (!isTextEntry || revealKeyIsModifier);
    if (canRevealHints && isRevealKeydown(event)) {
      if (!isTextEntry) event.preventDefault();
      shortcutHintKeyHeld = true;
      return;
    }
    void handleShortcut(event);
  }

  function handleGlobalKeyup(event: KeyboardEvent) {
    if (singleKeyFromEvent(event) === settings.shortcuts.revealKey) {
      shortcutHintKeyHeld = false;
    }
  }

  function hideShortcutHints() {
    shortcutHintKeyHeld = false;
  }

  async function syncLocalChanges(
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  ) {
    const tasks: Promise<void>[] = [];
    if (changes[storageKeys.favorites]) {
      tasks.push(loadFavorites().then((value) => {
        favorites = value;
        if (activeFolderId && !value.some((item) => item.kind === 'folder' && item.id === activeFolderId)) {
          activeFolderId = '';
          if (activeDialog === 'folder-app') closeFolderAppDialog();
        }
      }));
    }
    if (changes[storageKeys.activeTodos] || changes[storageKeys.legacyTodos]) {
      tasks.push(loadActiveTodos().then((value) => { activeTodos = value; }));
    }
    if (completedTodosLoaded && changes[storageKeys.completedTodos]) {
      tasks.push(loadCompletedTodos().then((value) => { completedTodos = value; }));
    }
    if (changes[storageKeys.todoTags]) {
      tasks.push(loadTodoTags().then((value) => { todoTags = value; }));
    }
    if (changes[storageKeys.timer]) {
      tasks.push(loadTimer().then((value) => { timer = value; }));
    }
    if (changes[storageKeys.stats]) {
      tasks.push(loadStats().then((value) => {
        weeklyStats = statsInRange(value, localWeekRange());
        if (monthlyStatsLoaded) monthlyStats = statsInRange(value, localMonthRange());
      }));
    }
    if (changes[NOTES_UI_STATE_KEY]) {
      hasNotes = normalizeNotesUiState(changes[NOTES_UI_STATE_KEY].newValue).hasNotes;
    }
    await Promise.all(tasks);
  }

  function handleStorageChanges(
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    areaName: string,
  ) {
    if (areaName === 'local') {
      void syncLocalChanges(changes)
        .catch((error) => reportError(error, 'Veriler diğer sekmeyle eşitlenemedi.'));
    }
    if (areaName === 'sync' && changes[storageKeys.settings]) {
      void loadSettings().then((value) => {
        settings = value;
        applyTheme(settings.theme);
      }).catch((error) => reportError(error, 'Ayarlar eşitlenemedi.'));
    }
  }

  function applyInitialResult<T>(
    result: PromiseSettledResult<T>,
    apply: (value: T) => void,
  ): boolean {
    if (result.status === 'fulfilled') {
      apply(result.value);
      return true;
    }
    return false;
  }

  function markInitialLoadErrors(results: PromiseSettledResult<unknown>[]) {
    if (results.some((result) => result.status === 'rejected')) {
      appError = 'Bazı veriler yüklenemedi. Sayfayı yenileyerek tekrar deneyebilirsiniz.';
    }
  }

  onMount(() => {
    const initialize = async () => {
      await requestTimerReconciliation().catch(() => undefined);
      const results = await Promise.allSettled([
        loadFavorites(),
        loadActiveTodos(),
        loadTodoTags(),
        loadTimer(),
        loadStatsRange(localWeekRange()),
        loadRecentBookmarks(),
        loadNotesUiState(),
        refreshWallpaper(),
      ]);

      applyInitialResult(results[0], (value) => { favorites = value; });
      applyInitialResult(results[1], (value) => { activeTodos = value; });
      applyInitialResult(results[2], (value) => { todoTags = value; });
      applyInitialResult(results[3], (value) => { timer = value; });
      applyInitialResult(results[4], (value) => { weeklyStats = value; });
      applyInitialResult(results[5], (value) => { recentBookmarks = value; });
      applyInitialResult(results[6], (value) => { hasNotes = value.hasNotes; });
      markInitialLoadErrors(results);
      loaded = true;

      if (timer.status === 'running' && timer.endsAt && timer.endsAt <= Date.now()) {
        await requestCompletion(timer.sessionId);
      }
    };

    void initialize().catch((error) => {
      loaded = true;
      reportError(error, 'Uygulama verileri yüklenemedi.');
    });
    updateClock();
    clockInterval = window.setInterval(updateClock, 30_000);
    window.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('keyup', handleGlobalKeyup);
    window.addEventListener('blur', hideShortcutHints);
    browser.storage.onChanged.addListener(handleStorageChanges);
    browser.bookmarks.onCreated.addListener(handleBookmarksChanged);
    browser.bookmarks.onRemoved.addListener(handleBookmarksChanged);
    browser.bookmarks.onChanged.addListener(handleBookmarksChanged);
    browser.bookmarks.onMoved.addListener(handleBookmarksChanged);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
    window.removeEventListener('keyup', handleGlobalKeyup);
    window.removeEventListener('blur', hideShortcutHints);
    browser.storage.onChanged.removeListener(handleStorageChanges);
    browser.bookmarks.onCreated.removeListener(handleBookmarksChanged);
    browser.bookmarks.onRemoved.removeListener(handleBookmarksChanged);
    browser.bookmarks.onChanged.removeListener(handleBookmarksChanged);
    browser.bookmarks.onMoved.removeListener(handleBookmarksChanged);
    if (clockInterval) window.clearInterval(clockInterval);
    if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
  });
</script>

<svelte:head>
  <meta name="theme-color" content={settings.theme.pageBackgroundColor} />
</svelte:head>

<div
  class:has-image={hasWallpaper}
  class="wallpaper"
  style:background-image={wallpaperUrl ? `url("${wallpaperUrl}")` : ''}
  aria-hidden="true"
></div>
<div class:has-image={hasWallpaper} class="wallpaper-overlay" aria-hidden="true"></div>

{#if loaded}
  <main class:has-wallpaper={hasWallpaper} class="page-shell">
    <header class="topbar">
      <ClockCard time={timeLabel} date={dateLabel} />
      <div class="topbar-actions">
        <IconButton
          label="Not defterini aç"
          title="Not defteri"
          class={`settings-button notes-button ${hasNotes ? 'notes-button--filled' : ''}`}
          onclick={() => (activeDialog = 'notes')}
        >
          <Icon name="text" size={17} />
        </IconButton>
        <IconButton label="Ayarları aç" title="Ayarlar" class="settings-button" onclick={() => (activeDialog = 'settings')}>
          <Icon name="sliders" size={17} />
        </IconButton>
      </div>
    </header>

    <div class="dashboard-grid">
      <div class="dashboard-column dashboard-column--left">
        <FavoriteGrid
          {favorites}
          showNames={settings.theme.showFavoriteNames}
          {showShortcutHints}
          onAdd={() => openFavoriteDialog()}
          onOpenFolder={openAppDrawer}
          onEdit={openFavoriteDialog}
          onDelete={(favorite) => void deleteFavorite(favorite)}
          onReorder={(sourceId, targetId) => void reorderFavorites(sourceId, targetId)}
        />
        <BookmarkCard
          bookmarks={recentBookmarks}
          onShowAll={() => void openBookmarksDialog()}
          onRemove={(bookmark) => void deleteBookmark(bookmark)}
        />
      </div>

      <div class="dashboard-column dashboard-column--center">
        <FocusCard
          {timer}
          {settings}
          {showShortcutHints}
          onTimerChange={(next) => (timer = next)}
          onOpenSettings={() => (activeDialog = 'pomodoro')}
        />
        <StatsCard stats={weeklyStats} {timer} onShowDetails={() => void openStatsDialog()} />
      </div>

      <div class="dashboard-column dashboard-column--right">
        <MediaPlayer
          shortcut={settings.media.shortcut}
          {showShortcutHints}
          onOpenSettings={() => (activeDialog = 'media')}
        />
        <TodoCard
          todos={activeTodos}
          tags={todoTags}
          selectedTagId={selectedTodoTagId}
          filterDirection={todoFilterDirection}
          shortcut={settings.shortcuts.todoFocus}
          {showShortcutHints}
          focusRequest={todoFocusRequest}
          rowFocusRequest={activeDialog ? 0 : todoRowsFocusRequest}
          onChange={(next, nextTags) => {
            void updateActiveTodos(next, nextTags ?? todoTags)
              .catch((error) => reportError(error, 'Görevler kaydedilemedi.'));
          }}
          onFilterChange={selectTodoFilter}
          onShowAll={(tagId) => void openTodosDialog(tagId)}
        />
      </div>
    </div>
  </main>
{:else}
  <div class="app-loading" aria-label="page-can yükleniyor">
    <span class="brand-mark large">pc</span>
  </div>
{/if}

{#if activeFolder}
  <AppDrawer
    folder={activeFolder}
    showNames={settings.theme.showFavoriteNames}
    {showShortcutHints}
    suspended={Boolean(activeDialog)}
    onClose={() => (activeFolderId = '')}
    onAdd={() => openFolderAppDialog(activeFolder)}
    onEdit={(app) => openFolderAppDialog(activeFolder, app)}
    onDelete={(app) => void deleteFolderApp(activeFolder, app)}
    onReorder={(sourceId, targetId) => void reorderFolderApps(activeFolder, sourceId, targetId)}
  />
{/if}

{#if appError}
  <div class="app-notice" role="alert">
    <span>{appError}</span>
    <button type="button" onclick={() => (appError = '')}>Kapat</button>
  </div>
{/if}

{#if activeDialog === 'folder-app' && activeFolder}
  <FolderAppDialog
    app={editingFolderApp}
    folderName={activeFolder.name}
    onClose={closeFolderAppDialog}
    onSave={saveFolderApp}
  />
{/if}

{#if activeDialog === 'settings'}
  <SettingsDialog
    {settings}
    {hasWallpaper}
    wallpaperPreviewUrl={wallpaperUrl}
    {favoriteShortcuts}
    reservedShortcuts={TODO_FILTER_SHORTCUTS}
    onClose={() => (activeDialog = null)}
    onSave={updateSettings}
    onWallpaper={updateWallpaper}
    onAnalyzeWallpaper={analyzeCurrentWallpaper}
    onRemoveWallpaper={clearWallpaper}
  />
{/if}

{#if activeDialog === 'notes'}
  <NotesDialog
    onClose={() => (activeDialog = null)}
    onPresenceChange={(value) => (hasNotes = value)}
  />
{/if}

{#if activeDialog === 'favorite'}
  <FavoriteDialog
    favorite={editingFavorite}
    {favorites}
    reservedShortcuts={[
      settings.pomodoro.shortcut,
      settings.media.shortcut,
      ...globalActionShortcuts,
    ].filter(Boolean)}
    onClose={() => (activeDialog = null)}
    onSave={saveFavorite}
  />
{/if}

{#if activeDialog === 'bookmarks'}
  <BookmarksDialog
    bookmarks={allBookmarks}
    loading={bookmarksLoading}
    onClose={closeBookmarksDialog}
    onRemove={(bookmark) => void deleteBookmark(bookmark)}
  />
{/if}

{#if activeDialog === 'todos'}
  <TodosDialog
    todos={[...activeTodos, ...(completedTodosLoaded ? completedTodos : [])]}
    tags={todoTags}
    selectedTagId={selectedTodoTagId}
    filterDirection={todoFilterDirection}
    loading={todosLoading}
    tagManagementReady={completedTodosLoaded}
    showShortcutHints={shortcutHintKeyHeld}
    rowFocusRequest={todoRowsFocusRequest}
    onClose={closeTodosDialog}
    onFilterChange={selectTodoFilter}
    onChange={(next, nextTags) => {
      const tags = nextTags ?? todoTags;
      const persist = completedTodosLoaded
        ? updateAllTodos(next, tags)
        : updateActiveTodos(next, tags);
      void persist
        .catch((error) => reportError(error, 'Görevler kaydedilemedi.'));
    }}
  />
{/if}

{#if activeDialog === 'pomodoro'}
  <FocusSettingsDialog
    preferences={settings.pomodoro}
    {favoriteShortcuts}
    reservedShortcuts={[settings.media.shortcut, ...globalActionShortcuts].filter(Boolean)}
    onClose={() => (activeDialog = null)}
    onSave={updatePomodoroPreferences}
  />
{/if}

{#if activeDialog === 'media'}
  <MediaSettingsDialog
    preferences={settings.media}
    reservedShortcuts={[
      settings.pomodoro.shortcut,
      ...favoriteShortcuts,
      ...globalActionShortcuts,
    ].filter(Boolean)}
    onClose={() => (activeDialog = null)}
    onSave={updateMediaPreferences}
  />
{/if}

{#if activeDialog === 'stats'}
  <StatsDetailDialog
    stats={monthlyStats}
    {timer}
    loading={statsLoading}
    onClose={closeStatsDialog}
    onUpdateDay={updateStatsDay}
  />
{/if}

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import AllBookmarksModal from '../../components/AllBookmarksModal.svelte';
  import AllTodosModal from '../../components/AllTodosModal.svelte';
  import BookmarkCard from '../../components/BookmarkCard.svelte';
  import ClockCard from '../../components/ClockCard.svelte';
  import FavoriteDialog from '../../components/FavoriteDialog.svelte';
  import FavoriteGrid from '../../components/FavoriteGrid.svelte';
  import Icon from '../../components/Icon.svelte';
  import IconButton from '../../components/IconButton.svelte';
  import PomodoroCard from '../../components/PomodoroCard.svelte';
  import PomodoroSettingsDialog from '../../components/PomodoroSettingsDialog.svelte';
  import SettingsModal from '../../components/SettingsModal.svelte';
  import StatsCard from '../../components/StatsCard.svelte';
  import StatsDetailDialog from '../../components/StatsDetailDialog.svelte';
  import TodoCard from '../../components/TodoCard.svelte';
  import { loadBookmarkData, removeBookmark } from '../../lib/bookmarks';
  import { durationForMode, requestCompletion, toggleTimer } from '../../lib/pomodoro';
  import {
    loadFavorites,
    loadStats,
    loadTimer,
    loadTodos,
    saveFavorites,
    saveSettings,
    saveTimer,
    saveTodos,
    storageKeys,
  } from '../../lib/storage';
  import { applyTheme } from '../../lib/theme';
  import type {
    AppSettings,
    BookmarkItem,
    DailyStat,
    Favorite,
    PomodoroPreferences,
    PomodoroState,
    Todo,
  } from '../../lib/types';
  import { eventShortcut } from '../../lib/utils';
  import {
    analyzeWallpaper,
    getWallpaper,
    optimizeWallpaper,
    removeWallpaper,
    saveWallpaper,
  } from '../../lib/wallpaper';

  export let initialSettings: AppSettings;

  type DialogName = 'appearance' | 'favorite' | 'bookmarks' | 'todos' | 'pomodoro' | 'stats';

  let settings = initialSettings;
  let favorites: Favorite[] = [];
  let todos: Todo[] = [];
  let timer: PomodoroState;
  let stats: DailyStat[] = [];
  let recentBookmarks: BookmarkItem[] = [];
  let allBookmarks: BookmarkItem[] = [];
  let loaded = false;
  let activeDialog: DialogName | null = null;
  let editingFavorite: Favorite | null = null;
  let wallpaperUrl = '';
  let hasWallpaper = false;
  let clockInterval: number | undefined;

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

  function updateClock() {
    const now = new Date();
    dateLabel = dateFormatter.format(now);
    timeLabel = timeFormatter.format(now);
  }

  async function refreshBookmarks() {
    const data = await loadBookmarkData();
    recentBookmarks = data.recent;
    allBookmarks = data.flat;
  }

  async function refreshWallpaper() {
    const wallpaper = await getWallpaper();
    if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
    wallpaperUrl = wallpaper ? URL.createObjectURL(wallpaper) : '';
    hasWallpaper = Boolean(wallpaper);
  }

  async function updateFavorites(next: Favorite[]) {
    favorites = next;
    await saveFavorites(favorites);
  }

  function openFavoriteDialog(favorite: Favorite | null = null) {
    editingFavorite = favorite;
    activeDialog = 'favorite';
  }

  async function saveFavorite(favorite: Favorite) {
    const exists = favorites.some((item) => item.id === favorite.id);
    if (!exists && favorites.length >= 15) return;
    const next = exists
      ? favorites.map((item) => item.id === favorite.id ? favorite : item)
      : [...favorites, favorite];
    await updateFavorites(next);
  }

  async function deleteFavorite(favorite: Favorite) {
    await updateFavorites(favorites.filter((item) => item.id !== favorite.id));
  }

  async function deleteBookmark(bookmark: BookmarkItem) {
    await removeBookmark(bookmark.id);
    await refreshBookmarks();
  }

  async function updateTodos(next: Todo[]) {
    todos = next;
    await saveTodos(todos);
  }

  async function updateSettings(next: AppSettings) {
    settings = structuredClone(next);
    applyTheme(settings.theme);
    await saveSettings(settings);

    if (timer.status === 'idle') {
      const durationSec = durationForMode(timer.mode, settings);
      timer = { ...timer, durationSec, remainingSec: durationSec };
      await saveTimer(timer);
    }
  }

  async function updatePomodoroPreferences(pomodoro: PomodoroPreferences) {
    await updateSettings({ ...settings, pomodoro });
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

  async function handleShortcut(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (
      !loaded ||
      !timer ||
      target?.closest('input, textarea, select, button, a, [role="textbox"]') ||
      target?.isContentEditable ||
      event.isComposing ||
      event.repeat ||
      activeDialog
    ) return;

    const pressed = eventShortcut(event);
    if (pressed === settings.pomodoro.shortcut) {
      event.preventDefault();
      timer = await toggleTimer(timer, settings);
      return;
    }

    const favorite = favorites.find((item) => item.shortcut && item.shortcut === pressed);
    if (favorite) {
      event.preventDefault();
      window.location.assign(favorite.url);
    }
  }

  function handleStorageChanges(
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    areaName: string,
  ) {
    if (areaName === 'local') {
      const timerChange = changes[storageKeys.timer];
      const statsChange = changes[storageKeys.stats];
      if (timerChange?.newValue) {
        timer = timerChange.newValue as PomodoroState;
      }
      if (statsChange?.newValue) {
        stats = statsChange.newValue as DailyStat[];
      }
    }
    const settingsChange = changes[storageKeys.settings];
    if (areaName === 'sync' && settingsChange?.newValue) {
      const incoming = settingsChange.newValue as Partial<AppSettings>;
      settings = {
        theme: { ...settings.theme, ...incoming.theme },
        pomodoro: { ...settings.pomodoro, ...incoming.pomodoro },
      };
      applyTheme(settings.theme);
    }
  }

  onMount(() => {
    const initialize = async () => {
      const [loadedFavorites, loadedTodos, loadedTimer, loadedStats] = await Promise.all([
        loadFavorites(),
        loadTodos(),
        loadTimer(),
        loadStats(),
        refreshBookmarks(),
        refreshWallpaper(),
      ]);
      favorites = loadedFavorites;
      todos = loadedTodos;
      timer = loadedTimer;
      stats = loadedStats;
      loaded = true;

      if (timer.status === 'running' && timer.endsAt && timer.endsAt <= Date.now()) {
        await requestCompletion(timer.sessionId);
      }
    };

    void initialize();
    updateClock();
    clockInterval = window.setInterval(updateClock, 30_000);
    window.addEventListener('keydown', handleShortcut);
    browser.storage.onChanged.addListener(handleStorageChanges);
    browser.bookmarks.onCreated.addListener(refreshBookmarks);
    browser.bookmarks.onRemoved.addListener(refreshBookmarks);
    browser.bookmarks.onChanged.addListener(refreshBookmarks);
    browser.bookmarks.onMoved.addListener(refreshBookmarks);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleShortcut);
    browser.storage.onChanged.removeListener(handleStorageChanges);
    browser.bookmarks.onCreated.removeListener(refreshBookmarks);
    browser.bookmarks.onRemoved.removeListener(refreshBookmarks);
    browser.bookmarks.onChanged.removeListener(refreshBookmarks);
    browser.bookmarks.onMoved.removeListener(refreshBookmarks);
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
      <IconButton label="Görünüm ayarlarını aç" title="Görünüm" class="settings-button" onclick={() => (activeDialog = 'appearance')}>
        <Icon name="sliders" size={17} />
      </IconButton>
    </header>

    <div class="dashboard-grid">
      <div class="dashboard-column dashboard-column--left">
        <FavoriteGrid
          {favorites}
          showNames={settings.theme.showFavoriteNames}
          onAdd={() => openFavoriteDialog()}
          onEdit={openFavoriteDialog}
          onDelete={(favorite) => void deleteFavorite(favorite)}
        />
        <BookmarkCard
          bookmarks={recentBookmarks}
          onShowAll={() => (activeDialog = 'bookmarks')}
          onRemove={(bookmark) => void deleteBookmark(bookmark)}
        />
      </div>

      <div class="dashboard-column dashboard-column--center">
        <PomodoroCard
          {timer}
          {settings}
          onTimerChange={(next) => (timer = next)}
          onOpenSettings={() => (activeDialog = 'pomodoro')}
        />
        <StatsCard {stats} {timer} onShowDetails={() => (activeDialog = 'stats')} />
      </div>

      <div class="dashboard-column dashboard-column--right">
        <TodoCard
          {todos}
          onChange={updateTodos}
          onShowAll={() => (activeDialog = 'todos')}
        />
      </div>
    </div>
  </main>
{:else}
  <div class="app-loading" aria-label="page-can yükleniyor">
    <span class="brand-mark large">pc</span>
  </div>
{/if}

{#if activeDialog === 'appearance'}
  <SettingsModal
    {settings}
    {hasWallpaper}
    onClose={() => (activeDialog = null)}
    onSave={updateSettings}
    onWallpaper={updateWallpaper}
    onAnalyzeWallpaper={analyzeCurrentWallpaper}
    onRemoveWallpaper={clearWallpaper}
  />
{/if}

{#if activeDialog === 'favorite'}
  <FavoriteDialog
    favorite={editingFavorite}
    {favorites}
    reservedShortcut={settings.pomodoro.shortcut}
    onClose={() => (activeDialog = null)}
    onSave={saveFavorite}
  />
{/if}

{#if activeDialog === 'bookmarks'}
  <AllBookmarksModal
    bookmarks={allBookmarks}
    onClose={() => (activeDialog = null)}
    onRemove={(bookmark) => void deleteBookmark(bookmark)}
  />
{/if}

{#if activeDialog === 'todos'}
  <AllTodosModal
    {todos}
    onClose={() => (activeDialog = null)}
    onChange={updateTodos}
  />
{/if}

{#if activeDialog === 'pomodoro'}
  <PomodoroSettingsDialog
    preferences={settings.pomodoro}
    favoriteShortcuts={favorites.map((favorite) => favorite.shortcut).filter(Boolean)}
    onClose={() => (activeDialog = null)}
    onSave={updatePomodoroPreferences}
  />
{/if}

{#if activeDialog === 'stats'}
  <StatsDetailDialog {stats} {timer} onClose={() => (activeDialog = null)} />
{/if}

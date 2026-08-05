import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, DEFAULT_TIMER } from './defaults';
import type { AppSettings, DailyStat, Favorite, PomodoroState, Todo } from './types';

const SYNC_SETTINGS_KEY = 'settings';
const LOCAL_FAVORITES_KEY = 'favorites';
const LOCAL_TODOS_KEY = 'todos';
const LOCAL_TIMER_KEY = 'pomodoroState';
const LOCAL_STATS_KEY = 'dailyStats';

export async function loadSettings(): Promise<AppSettings> {
  const result = await browser.storage.sync.get(SYNC_SETTINGS_KEY);
  const stored = result[SYNC_SETTINGS_KEY] as Partial<AppSettings> | undefined;

  return {
    theme: {
      ...DEFAULT_SETTINGS.theme,
      ...stored?.theme,
    },
    pomodoro: {
      ...DEFAULT_SETTINGS.pomodoro,
      ...stored?.pomodoro,
    },
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await browser.storage.sync.set({ [SYNC_SETTINGS_KEY]: settings });
}

export async function loadFavorites(): Promise<Favorite[]> {
  const result = await browser.storage.local.get(LOCAL_FAVORITES_KEY);
  return (result[LOCAL_FAVORITES_KEY] as Favorite[] | undefined) ?? [];
}

export async function saveFavorites(favorites: Favorite[]): Promise<void> {
  await browser.storage.local.set({ [LOCAL_FAVORITES_KEY]: favorites });
}

export async function loadTodos(): Promise<Todo[]> {
  const result = await browser.storage.local.get(LOCAL_TODOS_KEY);
  return (result[LOCAL_TODOS_KEY] as Todo[] | undefined) ?? [];
}

export async function saveTodos(todos: Todo[]): Promise<void> {
  await browser.storage.local.set({ [LOCAL_TODOS_KEY]: todos });
}

export async function loadTimer(): Promise<PomodoroState> {
  const result = await browser.storage.local.get(LOCAL_TIMER_KEY);
  return {
    ...DEFAULT_TIMER,
    ...(result[LOCAL_TIMER_KEY] as Partial<PomodoroState> | undefined),
  };
}

export async function saveTimer(timer: PomodoroState): Promise<void> {
  await browser.storage.local.set({ [LOCAL_TIMER_KEY]: timer });
}

export async function loadStats(): Promise<DailyStat[]> {
  const result = await browser.storage.local.get(LOCAL_STATS_KEY);
  return (result[LOCAL_STATS_KEY] as DailyStat[] | undefined) ?? [];
}

export async function saveStats(stats: DailyStat[]): Promise<void> {
  await browser.storage.local.set({ [LOCAL_STATS_KEY]: stats });
}

export const storageKeys = {
  settings: SYNC_SETTINGS_KEY,
  favorites: LOCAL_FAVORITES_KEY,
  todos: LOCAL_TODOS_KEY,
  timer: LOCAL_TIMER_KEY,
  stats: LOCAL_STATS_KEY,
} as const;

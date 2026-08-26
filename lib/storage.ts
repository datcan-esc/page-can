import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, DEFAULT_TIMER } from './defaults';
import { FAVORITE_CARD_LIMIT, FOLDER_APP_LIMIT } from './display-limits';
import { normalizeScratchpadText } from './scratchpad';
import {
  TODO_TAG_LIMIT,
  TODO_TAGS_PER_TODO_LIMIT,
  isValidTodoTagName,
  normalizeTodoTagName,
  normalizeTodoText,
  todoTagColor,
  todoTagKey,
} from './todos';
import type {
  AppSettings,
  DailyStat,
  Favorite,
  FavoriteFolder,
  FavoriteSite,
  FolderApp,
  FocusInterval,
  PomodoroState,
  TimerRecovery,
  Todo,
  TodoTag,
} from './types';
import { localDateKey, normalizeUrl } from './utils';

const SYNC_SETTINGS_KEY = 'settings';
const LOCAL_FAVORITES_KEY = 'favorites';
const LEGACY_LOCAL_TODOS_KEY = 'todos';
const LOCAL_ACTIVE_TODOS_KEY = 'activeTodos';
const LOCAL_COMPLETED_TODOS_KEY = 'completedTodos';
const LOCAL_TODO_TAGS_KEY = 'todoTags';
const LOCAL_TIMER_KEY = 'pomodoroState';
const LOCAL_STATS_KEY = 'dailyStats';
const LOCAL_SCRATCHPAD_KEY = 'scratchpadText';
export const FOCUS_STATS_RETENTION_DAYS = 31;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function colorValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function finiteNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function normalizeSettings(value: unknown): AppSettings {
  const stored = isRecord(value) ? value : {};
  const theme = isRecord(stored.theme) ? stored.theme : {};
  const pomodoro = isRecord(stored.pomodoro) ? stored.pomodoro : {};
  const media = isRecord(stored.media) ? stored.media : {};
  const shortcuts = isRecord(stored.shortcuts) ? stored.shortcuts : {};
  const mode = theme.mode === 'light' || theme.mode === 'dark' || theme.mode === 'system'
    ? theme.mode
    : DEFAULT_SETTINGS.theme.mode;
  const borderMode = theme.borderMode === 'custom' || theme.borderMode === 'auto'
    ? theme.borderMode
    : DEFAULT_SETTINGS.theme.borderMode;
  const wallpaperPosition = stringValue(theme.wallpaperPosition, '');
  const idleMinutes = Math.round(finiteNumber(
    pomodoro.idleMinutes,
    DEFAULT_SETTINGS.pomodoro.idleMinutes,
    0,
    60,
  ));
  const checkInMinutes = Math.round(finiteNumber(
    pomodoro.checkInMinutes,
    DEFAULT_SETTINGS.pomodoro.checkInMinutes,
    0,
    240,
  ));

  return {
    theme: {
      ...DEFAULT_SETTINGS.theme,
      mode,
      primaryColor: colorValue(theme.primaryColor, DEFAULT_SETTINGS.theme.primaryColor),
      autoAccent: booleanValue(theme.autoAccent, DEFAULT_SETTINGS.theme.autoAccent),
      showFavoriteNames: booleanValue(theme.showFavoriteNames, DEFAULT_SETTINGS.theme.showFavoriteNames),
      secondaryColor: colorValue(theme.secondaryColor, DEFAULT_SETTINGS.theme.secondaryColor),
      pageBackgroundColor: colorValue(theme.pageBackgroundColor, DEFAULT_SETTINGS.theme.pageBackgroundColor),
      cardColor: colorValue(theme.cardColor, DEFAULT_SETTINGS.theme.cardColor),
      cardOpacity: finiteNumber(theme.cardOpacity, DEFAULT_SETTINGS.theme.cardOpacity, 0.45, 1),
      cardBlur: finiteNumber(theme.cardBlur, DEFAULT_SETTINGS.theme.cardBlur, 0, 24),
      borderMode,
      borderColor: colorValue(theme.borderColor, DEFAULT_SETTINGS.theme.borderColor),
      wallpaperDim: finiteNumber(theme.wallpaperDim, DEFAULT_SETTINGS.theme.wallpaperDim, 0, 0.75),
      wallpaperBlur: finiteNumber(theme.wallpaperBlur, DEFAULT_SETTINGS.theme.wallpaperBlur, 0, 20),
      wallpaperPosition: [
        '50% 50%',
        '50% 0%',
        '50% 100%',
        '0% 50%',
        '100% 50%',
      ].includes(wallpaperPosition)
        ? wallpaperPosition
        : DEFAULT_SETTINGS.theme.wallpaperPosition,
    },
    pomodoro: {
      focusMinutes: Math.round(finiteNumber(
        pomodoro.focusMinutes,
        DEFAULT_SETTINGS.pomodoro.focusMinutes,
        1,
        240,
      )),
      shortcut: stringValue(pomodoro.shortcut, DEFAULT_SETTINGS.pomodoro.shortcut).slice(0, 64),
      idleMinutes,
      checkInMinutes: checkInMinutes > 0 ? Math.max(15, checkInMinutes) : 0,
    },
    media: {
      shortcut: stringValue(media.shortcut, DEFAULT_SETTINGS.media.shortcut).slice(0, 64),
    },
    shortcuts: {
      revealKey: stringValue(
        shortcuts.revealKey,
        DEFAULT_SETTINGS.shortcuts.revealKey,
      ).slice(0, 64),
      todoFocus: stringValue(
        shortcuts.todoFocus,
        DEFAULT_SETTINGS.shortcuts.todoFocus,
      ).slice(0, 64),
    },
  };
}

function normalizeFolderApp(value: unknown): FolderApp | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id, '');
  const name = stringValue(value.name, '').trim().slice(0, 32);
  let url: string;
  try {
    url = normalizeUrl(stringValue(value.url, ''));
  } catch {
    return null;
  }
  if (!id || !name || !url) return null;
  return {
    id,
    name,
    url,
    createdAt: finiteNumber(value.createdAt, 0, 0),
  };
}

function normalizeFavorite(value: unknown): Favorite | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id, '');
  const name = stringValue(value.name, '').trim().slice(0, 32);
  const createdAt = finiteNumber(value.createdAt, 0, 0);
  if (!id || !name) return null;

  if (value.kind === 'folder') {
    const folder: FavoriteFolder = {
      kind: 'folder',
      id,
      name,
      shortcut: stringValue(value.shortcut, '').slice(0, 64),
      apps: Array.isArray(value.apps)
        ? value.apps
          .map(normalizeFolderApp)
          .filter((app): app is FolderApp => app !== null)
          .slice(0, FOLDER_APP_LIMIT)
        : [],
      createdAt,
    };
    return folder;
  }

  let url: string;
  try {
    url = normalizeUrl(stringValue(value.url, ''));
  } catch {
    return null;
  }
  if (!url) return null;
  const site: FavoriteSite = {
    kind: 'site',
    id,
    name,
    url,
    shortcut: stringValue(value.shortcut, '').slice(0, 64),
    createdAt,
  };
  return site;
}

function normalizeFavorites(value: unknown): Favorite[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeFavorite)
    .filter((favorite): favorite is Favorite => favorite !== null)
    .slice(0, FAVORITE_CARD_LIMIT);
}

function normalizeTodo(value: unknown): Todo | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id, '');
  const title = normalizeTodoText(stringValue(value.title, ''));
  if (!id || !title) return null;
  const completed = booleanValue(value.completed, false);
  const completedAt = typeof value.completedAt === 'number' && Number.isFinite(value.completedAt)
    ? Math.max(0, value.completedAt)
    : undefined;
  const todo: Todo = {
    id,
    title,
    tagIds: Array.isArray(value.tagIds)
      ? [...new Set(value.tagIds.filter((tagId): tagId is string =>
        typeof tagId === 'string' && Boolean(tagId)))]
        .slice(0, TODO_TAGS_PER_TODO_LIMIT)
      : [],
    completed,
    createdAt: finiteNumber(value.createdAt, 0, 0),
  };
  if (completed && completedAt !== undefined) todo.completedAt = completedAt;
  return todo;
}

function normalizeTodos(value: unknown): Todo[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeTodo).filter((todo): todo is Todo => todo !== null);
}

function normalizeTodoTag(value: unknown): TodoTag | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id, '');
  const name = normalizeTodoTagName(stringValue(value.name, ''));
  if (!id || !isValidTodoTagName(name)) return null;
  return {
    id,
    name,
    color: colorValue(value.color, todoTagColor(name)),
    createdAt: finiteNumber(value.createdAt, 0, 0),
  };
}

export function normalizeTodoTags(value: unknown): TodoTag[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const names = new Set<string>();
  return value.flatMap((candidate) => {
    const tag = normalizeTodoTag(candidate);
    if (!tag || ids.has(tag.id) || names.has(todoTagKey(tag.name))) return [];
    ids.add(tag.id);
    names.add(todoTagKey(tag.name));
    return [tag];
  }).slice(0, TODO_TAG_LIMIT);
}

function normalizeTimer(value: unknown): PomodoroState {
  if (!isRecord(value)) return { ...DEFAULT_TIMER };
  if (value.mode === 'shortBreak' || value.mode === 'longBreak') return { ...DEFAULT_TIMER };

  const mode = value.mode === 'stopwatch' ? 'stopwatch' : 'focus';
  let status: PomodoroState['status'] = value.status === 'running' || value.status === 'paused'
    ? value.status
    : 'idle';
  const startedAt = typeof value.startedAt === 'number' && Number.isFinite(value.startedAt)
    ? Math.max(0, value.startedAt)
    : undefined;
  const endsAt = typeof value.endsAt === 'number' && Number.isFinite(value.endsAt)
    ? Math.max(0, value.endsAt)
    : undefined;
  const sessionId = typeof value.sessionId === 'string' && value.sessionId ? value.sessionId : undefined;
  const lastHeartbeatAt = typeof value.lastHeartbeatAt === 'number' && Number.isFinite(value.lastHeartbeatAt)
    ? Math.max(0, value.lastHeartbeatAt)
    : undefined;
  const checkInAt = typeof value.checkInAt === 'number' && Number.isFinite(value.checkInAt)
    ? Math.max(0, value.checkInAt)
    : undefined;
  const checkInPromptedAt = typeof value.checkInPromptedAt === 'number'
    && Number.isFinite(value.checkInPromptedAt)
    ? Math.max(0, value.checkInPromptedAt)
    : undefined;
  const segments: FocusInterval[] = Array.isArray(value.segments)
    ? value.segments.flatMap((candidate) => {
      if (!isRecord(candidate)) return [];
      const startAt = finiteNumber(candidate.startAt, -1, 0);
      const endAt = finiteNumber(candidate.endAt, -1, 0);
      return startAt >= 0 && endAt > startAt ? [{ startAt, endAt }] : [];
    }).slice(-128)
    : [];
  let recovery: TimerRecovery | undefined;
  if (isRecord(value.recovery)) {
    const reason = value.recovery.reason;
    const segmentStartAt = finiteNumber(value.recovery.segmentStartAt, -1, 0);
    const recordedEndAt = finiteNumber(value.recovery.recordedEndAt, -1, 0);
    const detectedAt = finiteNumber(value.recovery.detectedAt, -1, 0);
    if (
      (reason === 'offline' || reason === 'idle' || reason === 'locked' || reason === 'checkin')
      && segmentStartAt >= 0
      && recordedEndAt >= segmentStartAt
      && detectedAt >= recordedEndAt
    ) {
      recovery = {
        reason,
        segmentStartAt,
        recordedEndAt,
        detectedAt,
        excludedSec: Math.round(finiteNumber(
          value.recovery.excludedSec,
          Math.floor((detectedAt - recordedEndAt) / 1000),
          0,
        )),
      };
    }
  }
  if (status === 'running' && (!startedAt || (mode === 'focus' && (!endsAt || !sessionId)))) {
    status = 'paused';
  }

  const timer: PomodoroState = {
    mode,
    status,
    durationSec: Math.round(finiteNumber(value.durationSec, DEFAULT_TIMER.durationSec, 0)),
    remainingSec: Math.round(finiteNumber(value.remainingSec, DEFAULT_TIMER.remainingSec, 0)),
    elapsedSec: Math.round(finiteNumber(value.elapsedSec, 0, 0)),
  };
  if (startedAt !== undefined) timer.startedAt = startedAt;
  if (endsAt !== undefined) timer.endsAt = endsAt;
  if (sessionId !== undefined) timer.sessionId = sessionId;
  if (lastHeartbeatAt !== undefined) timer.lastHeartbeatAt = lastHeartbeatAt;
  if (checkInAt !== undefined) timer.checkInAt = checkInAt;
  if (checkInPromptedAt !== undefined) timer.checkInPromptedAt = checkInPromptedAt;
  if (segments.length) timer.segments = segments;
  if (recovery) timer.recovery = recovery;
  return timer;
}

function normalizeStat(value: unknown): DailyStat | null {
  if (!isRecord(value) || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    return null;
  }
  const [year, month, day] = value.date.split('-').map(Number);
  const parsedDate = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12);
  if (localDateKey(parsedDate) !== value.date) return null;
  return {
    date: value.date,
    focusSeconds: Math.round(finiteNumber(value.focusSeconds, 0, 0)),
    completedSessions: Math.round(finiteNumber(value.completedSessions, 0, 0)),
  };
}

function normalizeStats(value: unknown): DailyStat[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeStat).filter((stat): stat is DailyStat => stat !== null);
}

function retainRecentStats(stats: DailyStat[], reference = new Date()): DailyStat[] {
  const today = new Date(reference);
  today.setHours(12, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (FOCUS_STATS_RETENTION_DAYS - 1));
  const cutoffKey = localDateKey(cutoff);
  const todayKey = localDateKey(today);
  return stats.filter((item) => item.date >= cutoffKey && item.date <= todayKey);
}

export function statsInRange(
  stats: DailyStat[],
  range: { start: string; end: string },
): DailyStat[] {
  return stats.filter((item) => item.date >= range.start && item.date <= range.end);
}

export async function loadSettings(): Promise<AppSettings> {
  const result = await browser.storage.sync.get(SYNC_SETTINGS_KEY);
  return normalizeSettings(result[SYNC_SETTINGS_KEY]);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await browser.storage.sync.set({ [SYNC_SETTINGS_KEY]: normalizeSettings(settings) });
}

export async function loadFavorites(): Promise<Favorite[]> {
  const result = await browser.storage.local.get(LOCAL_FAVORITES_KEY);
  return normalizeFavorites(result[LOCAL_FAVORITES_KEY]);
}

export async function saveFavorites(favorites: Favorite[]): Promise<void> {
  await browser.storage.local.set({ [LOCAL_FAVORITES_KEY]: normalizeFavorites(favorites) });
}

let todoMigrationPromise: Promise<void> | undefined;

async function migrateTodoStorage(): Promise<void> {
  const initial = await browser.storage.local.get([
    LEGACY_LOCAL_TODOS_KEY,
    LOCAL_ACTIVE_TODOS_KEY,
  ]);
  if (initial[LEGACY_LOCAL_TODOS_KEY] === undefined) return;

  const completedResult = await browser.storage.local.get(LOCAL_COMPLETED_TODOS_KEY);
  const legacyTodos = normalizeTodos(initial[LEGACY_LOCAL_TODOS_KEY]);
  const updates: Record<string, Todo[]> = {};
  if (initial[LOCAL_ACTIVE_TODOS_KEY] === undefined) {
    updates[LOCAL_ACTIVE_TODOS_KEY] = legacyTodos.filter((todo) => !todo.completed);
  }
  if (completedResult[LOCAL_COMPLETED_TODOS_KEY] === undefined) {
    updates[LOCAL_COMPLETED_TODOS_KEY] = legacyTodos.filter((todo) => todo.completed);
  }
  if (Object.keys(updates).length) await browser.storage.local.set(updates);
  await browser.storage.local.remove(LEGACY_LOCAL_TODOS_KEY);
}

async function ensureTodoStorage(): Promise<void> {
  todoMigrationPromise ??= migrateTodoStorage().catch((error) => {
    todoMigrationPromise = undefined;
    throw error;
  });
  await todoMigrationPromise;
}

export async function loadActiveTodos(): Promise<Todo[]> {
  await ensureTodoStorage();
  const result = await browser.storage.local.get(LOCAL_ACTIVE_TODOS_KEY);
  return normalizeTodos(result[LOCAL_ACTIVE_TODOS_KEY]).filter((todo) => !todo.completed);
}

export async function loadCompletedTodos(): Promise<Todo[]> {
  await ensureTodoStorage();
  const result = await browser.storage.local.get(LOCAL_COMPLETED_TODOS_KEY);
  return normalizeTodos(result[LOCAL_COMPLETED_TODOS_KEY]).filter((todo) => todo.completed);
}

export async function loadTodoTags(): Promise<TodoTag[]> {
  const result = await browser.storage.local.get(LOCAL_TODO_TAGS_KEY);
  return normalizeTodoTags(result[LOCAL_TODO_TAGS_KEY]);
}

function todoTagStorageUpdate(tags?: TodoTag[]): Record<string, TodoTag[]> {
  return tags ? { [LOCAL_TODO_TAGS_KEY]: normalizeTodoTags(tags) } : {};
}

export async function saveTodoTags(tags: TodoTag[]): Promise<void> {
  await browser.storage.local.set(todoTagStorageUpdate(tags));
}

export async function saveActiveTodos(todos: Todo[], tags?: TodoTag[]): Promise<void> {
  await ensureTodoStorage();
  await browser.storage.local.set({
    [LOCAL_ACTIVE_TODOS_KEY]: normalizeTodos(todos).filter((todo) => !todo.completed),
    ...todoTagStorageUpdate(tags),
  });
}

export async function moveTodosToCompleted(
  activeTodos: Todo[],
  completedTodos: Todo[],
  tags?: TodoTag[],
): Promise<void> {
  await ensureTodoStorage();
  const result = await browser.storage.local.get(LOCAL_COMPLETED_TODOS_KEY);
  const storedCompleted = normalizeTodos(result[LOCAL_COMPLETED_TODOS_KEY])
    .filter((todo) => todo.completed);
  const additions = normalizeTodos(completedTodos).map((todo) => ({
    ...todo,
    completed: true,
    completedAt: todo.completedAt ?? Date.now(),
  }));
  const additionIds = new Set(additions.map((todo) => todo.id));
  await browser.storage.local.set({
    [LOCAL_ACTIVE_TODOS_KEY]: normalizeTodos(activeTodos).filter((todo) => !todo.completed),
    [LOCAL_COMPLETED_TODOS_KEY]: [
      ...storedCompleted.filter((todo) => !additionIds.has(todo.id)),
      ...additions,
    ],
    ...todoTagStorageUpdate(tags),
  });
}

export async function saveTodoBuckets(
  activeTodos: Todo[],
  completedTodos: Todo[],
  tags?: TodoTag[],
): Promise<void> {
  await ensureTodoStorage();
  await browser.storage.local.set({
    [LOCAL_ACTIVE_TODOS_KEY]: normalizeTodos(activeTodos).filter((todo) => !todo.completed),
    [LOCAL_COMPLETED_TODOS_KEY]: normalizeTodos(completedTodos).filter((todo) => todo.completed),
    ...todoTagStorageUpdate(tags),
  });
}

export async function loadTimer(): Promise<PomodoroState> {
  const result = await browser.storage.local.get(LOCAL_TIMER_KEY);
  return normalizeTimer(result[LOCAL_TIMER_KEY]);
}

export async function saveTimer(timer: PomodoroState): Promise<void> {
  await browser.storage.local.set({ [LOCAL_TIMER_KEY]: normalizeTimer(timer) });
}

export async function loadStats(): Promise<DailyStat[]> {
  const result = await browser.storage.local.get(LOCAL_STATS_KEY);
  const stored = normalizeStats(result[LOCAL_STATS_KEY]);
  const retained = retainRecentStats(stored);
  if (retained.length !== stored.length) {
    await browser.storage.local.set({ [LOCAL_STATS_KEY]: retained });
  }
  return retained;
}

export async function loadStatsRange(range: { start: string; end: string }): Promise<DailyStat[]> {
  // İstatistik deposu en fazla 31 küçük kayıt tutar; anahtarları günlük parçalara bölmek
  // yerine çağırana yalnızca ihtiyaç duyduğu görünüm aralığını döndürüyoruz.
  return statsInRange(await loadStats(), range);
}

export async function saveStats(stats: DailyStat[]): Promise<void> {
  await browser.storage.local.set({
    [LOCAL_STATS_KEY]: retainRecentStats(normalizeStats(stats)),
  });
}

export async function loadScratchpadText(): Promise<string> {
  const result = await browser.storage.local.get(LOCAL_SCRATCHPAD_KEY);
  return normalizeScratchpadText(result[LOCAL_SCRATCHPAD_KEY]);
}

export async function saveScratchpadText(text: string): Promise<void> {
  await browser.storage.local.set({
    [LOCAL_SCRATCHPAD_KEY]: normalizeScratchpadText(text),
  });
}

export const storageKeys = {
  settings: SYNC_SETTINGS_KEY,
  favorites: LOCAL_FAVORITES_KEY,
  legacyTodos: LEGACY_LOCAL_TODOS_KEY,
  activeTodos: LOCAL_ACTIVE_TODOS_KEY,
  completedTodos: LOCAL_COMPLETED_TODOS_KEY,
  todoTags: LOCAL_TODO_TAGS_KEY,
  timer: LOCAL_TIMER_KEY,
  stats: LOCAL_STATS_KEY,
  scratchpad: LOCAL_SCRATCHPAD_KEY,
} as const;

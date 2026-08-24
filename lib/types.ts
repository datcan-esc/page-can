export type ThemeMode = 'light' | 'dark' | 'system';
export type BorderMode = 'auto' | 'custom';
export type PomodoroMode = 'focus' | 'stopwatch';
export type TimerStatus = 'idle' | 'running' | 'paused';
export type TimerPauseReason = 'offline' | 'idle' | 'locked' | 'checkin';

export interface FocusInterval {
  startAt: number;
  endAt: number;
}

export interface TimerRecovery {
  reason: TimerPauseReason;
  segmentStartAt: number;
  recordedEndAt: number;
  detectedAt: number;
  excludedSec: number;
}

export interface ThemePreferences {
  mode: ThemeMode;
  primaryColor: string;
  autoAccent: boolean;
  showFavoriteNames: boolean;
  secondaryColor: string;
  pageBackgroundColor: string;
  cardColor: string;
  cardOpacity: number;
  cardBlur: number;
  borderMode: BorderMode;
  borderColor: string;
  wallpaperDim: number;
  wallpaperBlur: number;
  wallpaperPosition: string;
}

export interface PomodoroPreferences {
  focusMinutes: number;
  shortcut: string;
  idleMinutes: number;
  checkInMinutes: number;
}

export interface MediaPreferences {
  shortcut: string;
}

export interface ShortcutPreferences {
  revealKey: string;
  todoFocus: string;
}

export interface AppSettings {
  theme: ThemePreferences;
  pomodoro: PomodoroPreferences;
  media: MediaPreferences;
  shortcuts: ShortcutPreferences;
}

export interface FavoriteSite {
  kind: 'site';
  id: string;
  name: string;
  url: string;
  shortcut: string;
  createdAt: number;
}

export interface FolderApp {
  id: string;
  name: string;
  url: string;
  createdAt: number;
}

export interface FavoriteFolder {
  kind: 'folder';
  id: string;
  name: string;
  shortcut: string;
  apps: FolderApp[];
  createdAt: number;
}

export type Favorite = FavoriteSite | FavoriteFolder;

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface PomodoroState {
  mode: PomodoroMode;
  status: TimerStatus;
  durationSec: number;
  remainingSec: number;
  elapsedSec: number;
  startedAt?: number;
  endsAt?: number;
  sessionId?: string;
  lastHeartbeatAt?: number;
  checkInAt?: number;
  checkInPromptedAt?: number;
  segments?: FocusInterval[];
  recovery?: TimerRecovery;
}

export interface DailyStat {
  date: string;
  focusSeconds: number;
  completedSessions: number;
}

export interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  dateAdded: number;
  path: string;
}

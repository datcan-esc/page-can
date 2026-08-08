export type ThemeMode = 'light' | 'dark' | 'system';
export type BorderMode = 'auto' | 'custom';
export type PomodoroMode = 'focus' | 'stopwatch';
export type TimerStatus = 'idle' | 'running' | 'paused';

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
}

export interface AppSettings {
  theme: ThemePreferences;
  pomodoro: PomodoroPreferences;
}

export interface Favorite {
  id: string;
  name: string;
  url: string;
  shortcut: string;
  createdAt: number;
}

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

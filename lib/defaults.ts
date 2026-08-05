import type { AppSettings, PomodoroState } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: {
    mode: 'dark',
    primaryColor: '#7c8cf8',
    secondaryColor: '#a6b1ff',
    cardColor: '#16171c',
    cardOpacity: 0.82,
    cardBlur: 16,
    borderMode: 'auto',
    borderColor: '#ffffff',
    wallpaperDim: 0.28,
    wallpaperBlur: 0,
    wallpaperPosition: '50% 50%',
  },
  pomodoro: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    autoStartBreaks: false,
    autoStartFocus: false,
    shortcut: 'Alt+P',
  },
};

export const DEFAULT_TIMER: PomodoroState = {
  mode: 'focus',
  status: 'idle',
  durationSec: 25 * 60,
  remainingSec: 25 * 60,
  focusCycle: 0,
};

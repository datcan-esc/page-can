import type { AppSettings, PomodoroState } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: {
    mode: 'dark',
    primaryColor: '#5e5ce6',
    autoAccent: false,
    showFavoriteNames: true,
    secondaryColor: '#8e8e93',
    pageBackgroundColor: '#0a0a0b',
    cardColor: '#171719',
    cardOpacity: 0.92,
    cardBlur: 20,
    borderMode: 'auto',
    borderColor: '#ffffff',
    wallpaperDim: 0.28,
    wallpaperBlur: 0,
    wallpaperPosition: '50% 50%',
  },
  pomodoro: {
    focusMinutes: 25,
    shortcut: 'Space',
  },
  media: {
    shortcut: '',
  },
};

export const DEFAULT_TIMER: PomodoroState = {
  mode: 'focus',
  status: 'idle',
  durationSec: 25 * 60,
  remainingSec: 25 * 60,
  elapsedSec: 0,
};

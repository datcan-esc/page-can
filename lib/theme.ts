import type { ThemeMode, ThemePreferences } from './types';

export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function readableTextColor(hex: string): '#111111' | '#ffffff' {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return '#ffffff';

  const red = Number.parseInt(clean.slice(0, 2), 16);
  const green = Number.parseInt(clean.slice(2, 4), 16);
  const blue = Number.parseInt(clean.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 150 ? '#111111' : '#ffffff';
}

export function applyTheme(theme: ThemePreferences): void {
  const root = document.documentElement;
  root.dataset.theme = resolveThemeMode(theme.mode);
  root.style.setProperty('--primary', theme.primaryColor);
  root.style.setProperty('--primary-contrast', readableTextColor(theme.primaryColor));
  root.style.setProperty('--secondary', theme.secondaryColor);
  root.style.setProperty('--card-rgb', hexToRgbChannels(theme.cardColor));
  root.style.setProperty('--card-opacity', String(theme.cardOpacity));
  root.style.setProperty('--card-blur', `${theme.cardBlur}px`);
  root.style.setProperty('--wallpaper-dim', String(theme.wallpaperDim));
  root.style.setProperty('--wallpaper-blur', `${theme.wallpaperBlur}px`);
  root.style.setProperty('--wallpaper-position', theme.wallpaperPosition);

  const border = theme.borderMode === 'custom'
    ? theme.borderColor
    : root.dataset.theme === 'light'
      ? 'rgb(15 23 42 / 10%)'
      : 'rgb(255 255 255 / 12%)';
  root.style.setProperty('--card-border', border);
}

function hexToRgbChannels(hex: string): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return '23 23 26';
  return [0, 2, 4]
    .map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16))
    .join(' ');
}

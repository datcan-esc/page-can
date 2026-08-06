import type { ThemeMode, ThemePreferences } from './types';

export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function readableTextColor(hex: string): '#111111' | '#ffffff' {
  return colorLuminance(hex) > 0.42 ? '#111111' : '#ffffff';
}

export function applyTheme(theme: ThemePreferences): void {
  const root = document.documentElement;
  const resolvedMode = resolveThemeMode(theme.mode);
  root.dataset.theme = resolvedMode;
  root.style.setProperty('--primary', theme.primaryColor);
  root.style.setProperty('--primary-contrast', readableTextColor(theme.primaryColor));
  root.style.setProperty('--secondary', theme.secondaryColor);
  root.style.setProperty(
    '--page-bg',
    theme.pageBackgroundColor || (resolvedMode === 'light' ? '#f2f2f7' : '#0a0a0b'),
  );
  root.style.setProperty('--card-rgb', hexToRgbChannels(theme.cardColor));
  const cardIsLight = colorLuminance(theme.cardColor) > 0.42;
  root.style.setProperty('--card-text', cardIsLight ? '#1c1c1e' : '#f5f5f7');
  root.style.setProperty('--card-muted', cardIsLight ? '#55555c' : '#b6b6bd');
  root.style.setProperty('--card-surface-soft', cardIsLight ? 'rgb(28 28 30 / 6%)' : 'rgb(255 255 255 / 6%)');
  root.style.setProperty('--card-surface-hover', cardIsLight ? 'rgb(28 28 30 / 10%)' : 'rgb(255 255 255 / 10%)');
  root.style.setProperty('--card-surface-active', cardIsLight ? 'rgb(28 28 30 / 14%)' : 'rgb(255 255 255 / 14%)');
  root.style.setProperty('--card-separator', cardIsLight ? 'rgb(28 28 30 / 10%)' : 'rgb(255 255 255 / 9%)');
  root.style.setProperty('--card-opacity', String(theme.cardOpacity));
  root.style.setProperty('--card-blur', `${theme.cardBlur}px`);
  root.style.setProperty('--wallpaper-dim', String(theme.wallpaperDim));
  root.style.setProperty('--wallpaper-blur', `${theme.wallpaperBlur}px`);
  root.style.setProperty('--wallpaper-position', theme.wallpaperPosition);

  const border = theme.borderMode === 'custom'
    ? theme.borderColor
    : cardIsLight
      ? 'rgb(15 23 42 / 9%)'
      : 'rgb(255 255 255 / 8%)';
  root.style.setProperty('--card-border', border);
}

function colorLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return 0;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function hexToRgbChannels(hex: string): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return '23 23 26';
  return [0, 2, 4]
    .map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16))
    .join(' ');
}

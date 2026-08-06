import { browser } from 'wxt/browser';

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(candidate).toString();
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function faviconUrl(url: string, size = 64): string {
  return browser.runtime.getURL(
    `/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`,
  );
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.floor(Math.max(0, totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shortcutFromEvent(event: KeyboardEvent): string | null {
  const ignoredKeys = new Set(['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Tab']);
  if (ignoredKeys.has(event.key)) return null;

  const modifiers = [
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Meta' : '',
  ].filter(Boolean);

  const key = event.code === 'Space'
    ? 'Space'
    : event.key.length === 1
      ? event.key.toLocaleUpperCase('tr-TR')
      : event.key;
  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(key);
  const isDirectKey = /^[A-ZÇĞİÖŞÜ0-9]$/u.test(key) || key === 'Space';
  if (modifiers.length === 0 && !isFunctionKey && !isDirectKey) return null;

  return [...modifiers, key].join('+');
}

export function eventShortcut(event: KeyboardEvent): string {
  const modifiers = [
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Meta' : '',
  ].filter(Boolean);
  const key = event.code === 'Space'
    ? 'Space'
    : event.key.length === 1
      ? event.key.toLocaleUpperCase('tr-TR')
      : event.key;
  return [...modifiers, key].join('+');
}

export function formatShortcut(shortcut: string): string {
  return shortcut === 'Space' ? 'Boşluk' : shortcut;
}

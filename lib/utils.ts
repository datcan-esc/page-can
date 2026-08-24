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

export interface LocalDateRange {
  start: string;
  end: string;
}

export function localWeekRange(reference = new Date()): LocalDateRange {
  const start = new Date(reference);
  start.setHours(12, 0, 0, 0);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: localDateKey(start), end: localDateKey(end) };
}

export function localMonthRange(reference = new Date()): LocalDateRange {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1, 12);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 12);
  return { start: localDateKey(start), end: localDateKey(end) };
}

function shortcutParts(event: KeyboardEvent): { modifiers: string[]; key: string } {
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
  return { modifiers, key };
}

export function shortcutFromEvent(event: KeyboardEvent): string | null {
  const ignoredKeys = new Set(['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Tab']);
  if (ignoredKeys.has(event.key)) return null;

  const { modifiers, key } = shortcutParts(event);
  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(key);
  const isDirectKey = /^[A-ZÇĞİÖŞÜ0-9]$/u.test(key) || key === 'Space';
  if (modifiers.length === 0 && !isFunctionKey && !isDirectKey) return null;

  return [...modifiers, key].join('+');
}

export function singleKeyFromEvent(event: KeyboardEvent): string | null {
  const modifierKeys: Record<string, string> = {
    Control: 'Ctrl',
    Shift: 'Shift',
    Alt: 'Alt',
    Meta: 'Meta',
  };
  const modifierKey = modifierKeys[event.key];
  if (modifierKey) return modifierKey;
  if (event.key === 'Tab' || event.key === 'CapsLock') return null;
  if (event.code === 'Space') return 'Space';

  const key = event.key.length === 1
    ? event.key.toLocaleUpperCase('tr-TR')
    : event.key;
  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(key);
  const isDirectKey = /^[A-ZÇĞİÖŞÜ0-9]$/u.test(key);
  return isFunctionKey || isDirectKey ? key : null;
}

export function eventShortcut(event: KeyboardEvent): string {
  const { modifiers, key } = shortcutParts(event);
  return [...modifiers, key].join('+');
}

export function numberShortcutIndex(event: KeyboardEvent): number | null {
  if (
    event.ctrlKey
    || event.altKey
    || event.shiftKey
    || event.metaKey
    || event.isComposing
    || event.repeat
    || !/^[1-9]$/.test(event.key)
  ) return null;

  return Number(event.key) - 1;
}

export function formatShortcut(shortcut: string): string {
  return shortcut === 'Space' ? 'Boşluk' : shortcut;
}

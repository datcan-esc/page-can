import type { DailyStat, PomodoroState } from './types';
import { loadStats, saveStats } from './storage';
import { localDateKey } from './utils';

export interface FocusSeriesItem {
  key: string;
  date: Date;
  label: string;
  dayNumber: number;
  minutes: number;
  sessions: number;
  isToday: boolean;
  inMonth: boolean;
}

function cloneStats(stats: DailyStat[]): DailyStat[] {
  return stats.map((item) => ({ ...item }));
}

function addIntervalToStats(
  stats: DailyStat[],
  startMs: number,
  endMs: number,
  completedSession = false,
): DailyStat[] {
  const next = cloneStats(stats);
  const byDate = new Map(next.map((item) => [item.date, item]));
  const safeStart = Math.max(0, startMs);
  const safeEnd = Math.max(safeStart, endMs);
  let cursor = safeStart;

  while (cursor < safeEnd) {
    const cursorDate = new Date(cursor);
    const nextMidnight = new Date(cursorDate);
    nextMidnight.setHours(24, 0, 0, 0);
    const sliceEnd = Math.min(safeEnd, nextMidnight.getTime());
    const seconds = Math.floor((sliceEnd - cursor) / 1000);
    const key = localDateKey(cursorDate);

    if (seconds > 0) {
      const existing = byDate.get(key);
      if (existing) {
        existing.focusSeconds += seconds;
      } else {
        const created: DailyStat = { date: key, focusSeconds: seconds, completedSessions: 0 };
        next.push(created);
        byDate.set(key, created);
      }
    }

    cursor = sliceEnd;
  }

  if (completedSession) {
    const completionDate = new Date(Math.max(safeStart, safeEnd - 1));
    const key = localDateKey(completionDate);
    const existing = byDate.get(key);
    if (existing) {
      existing.completedSessions += 1;
    } else {
      next.push({ date: key, focusSeconds: 0, completedSessions: 1 });
    }
  }

  return next;
}

export async function recordFocusInterval(
  startMs: number,
  endMs: number,
  completedSession = false,
): Promise<void> {
  const stats = await loadStats();
  const updated = addIntervalToStats(stats, startMs, endMs, completedSession);
  await saveStats(updated);
}

export function withLiveFocus(
  stats: DailyStat[],
  timer: PomodoroState,
  now = Date.now(),
): DailyStat[] {
  if (timer.status !== 'running' || !timer.startedAt) return stats;
  const end = timer.mode === 'focus' && timer.endsAt
    ? Math.min(now, timer.endsAt)
    : now;
  return addIntervalToStats(stats, timer.startedAt, end);
}

function itemForDate(
  byDate: Map<string, DailyStat>,
  date: Date,
  referenceMonth = date.getMonth(),
): FocusSeriesItem {
  const key = localDateKey(date);
  const stat = byDate.get(key);
  return {
    key,
    date: new Date(date),
    label: new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(date),
    dayNumber: date.getDate(),
    minutes: Math.round((stat?.focusSeconds ?? 0) / 60),
    sessions: stat?.completedSessions ?? 0,
    isToday: key === localDateKey(),
    inMonth: date.getMonth() === referenceMonth,
  };
}

export function makeFocusSeries(stats: DailyStat[], days: number): FocusSeriesItem[] {
  const byDate = new Map(stats.map((item) => [item.date, item]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (days - index - 1));
    return itemForDate(byDate, date);
  });
}

export function makeWeekSeries(stats: DailyStat[], reference = new Date()): FocusSeriesItem[] {
  const byDate = new Map(stats.map((item) => [item.date, item]));
  const monday = new Date(reference);
  monday.setHours(12, 0, 0, 0);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return itemForDate(byDate, date);
  });
}

export function makeMonthWeeks(
  stats: DailyStat[],
  reference = new Date(),
): FocusSeriesItem[][] {
  const byDate = new Map(stats.map((item) => [item.date, item]));
  const month = reference.getMonth();
  const first = new Date(reference.getFullYear(), month, 1, 12);
  const last = new Date(reference.getFullYear(), month + 1, 0, 12);
  const start = new Date(first);
  const firstDay = start.getDay() || 7;
  start.setDate(start.getDate() - firstDay + 1);
  const end = new Date(last);
  const lastDay = end.getDay() || 7;
  end.setDate(end.getDate() + (7 - lastDay));

  const days: FocusSeriesItem[] = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    days.push(itemForDate(byDate, date, month));
  }

  return Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
    days.slice(index * 7, index * 7 + 7));
}

export function averageActiveDayMinutes(series: FocusSeriesItem[]): number {
  const activeDays = series.filter((item) => item.minutes > 0);
  if (!activeDays.length) return 0;
  return Math.round(activeDays.reduce((sum, item) => sum + item.minutes, 0) / activeDays.length);
}

export function focusChartScale(values: number[]): { maxMinutes: number; hourTicks: number[] } {
  const maximumHours = Math.max(0, ...values) / 60;
  const completedHours = Math.floor(maximumHours);
  const reachesNextHour = maximumHours - completedHours > 0.5;
  const visibleHourCount = Math.min(24, Math.max(1, completedHours + (reachesNextHour ? 1 : 0)));
  return {
    maxMinutes: (visibleHourCount + 0.5) * 60,
    hourTicks: Array.from({ length: visibleHourCount }, (_, index) => (index + 1) * 60),
  };
}

export function formatFocusMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  if (safeMinutes < 60) return `${safeMinutes} dk`;
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return remainder ? `${hours} sa ${remainder} dk` : `${hours} sa`;
}

import type { DailyStat } from './types';
import { localDateKey } from './utils';

export interface FocusSeriesItem {
  key: string;
  label: string;
  minutes: number;
  sessions: number;
}

export function makeFocusSeries(stats: DailyStat[], days: number): FocusSeriesItem[] {
  const byDate = new Map(stats.map((item) => [item.date, item]));

  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    const key = localDateKey(date);
    const stat = byDate.get(key);

    return {
      key,
      label: new Intl.DateTimeFormat('tr-TR', days <= 7
        ? { weekday: 'short' }
        : { day: 'numeric' }).format(date),
      minutes: Math.round((stat?.focusSeconds ?? 0) / 60),
      sessions: stat?.completedSessions ?? 0,
    };
  });
}

import type { PomodoroState } from './types';

export const STOPWATCH_HEARTBEAT_INTERVAL_MINUTES = 1;
export const STOPWATCH_STALE_AFTER_MS = 3 * 60 * 1000;
export const STOPWATCH_CHECKIN_RESPONSE_MS = 5 * 60 * 1000;

export function safeStopwatchEnd(timer: PomodoroState, now = Date.now()): number {
  if (timer.mode !== 'stopwatch' || timer.status !== 'running' || !timer.startedAt) return now;
  const verifiedAt = timer.lastHeartbeatAt ?? timer.startedAt;
  return Math.min(now, verifiedAt + STOPWATCH_STALE_AFTER_MS);
}

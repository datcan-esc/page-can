import { browser } from 'wxt/browser';
import type { AppSettings, PomodoroMode, PomodoroState } from './types';
import { recordFocusInterval } from './stats';
import { saveTimer } from './storage';
import { createId } from './utils';

export const POMODORO_ALARM = 'page-can-pomodoro';

export function durationForMode(mode: PomodoroMode, settings: AppSettings): number {
  if (mode === 'stopwatch') return 0;
  return Math.max(1, Math.round(settings.pomodoro.focusMinutes * 60));
}

export function remainingSeconds(timer: PomodoroState, now = Date.now()): number {
  if (timer.mode !== 'focus') return 0;
  if (timer.status !== 'running' || !timer.endsAt) return timer.remainingSec;
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

export function elapsedSeconds(timer: PomodoroState, now = Date.now()): number {
  const stored = Math.max(0, timer.elapsedSec ?? 0);
  if (timer.mode !== 'stopwatch' || timer.status !== 'running' || !timer.startedAt) return stored;
  return stored + Math.max(0, Math.floor((now - timer.startedAt) / 1000));
}

async function recordRunningSegment(timer: PomodoroState, now: number): Promise<number> {
  if (timer.status !== 'running' || !timer.startedAt) return 0;
  const end = timer.mode === 'focus' && timer.endsAt
    ? Math.min(now, timer.endsAt)
    : now;
  if (end <= timer.startedAt) return 0;
  await recordFocusInterval(timer.startedAt, end);
  return Math.max(0, Math.floor((end - timer.startedAt) / 1000));
}

export async function toggleTimer(
  timer: PomodoroState,
  settings: AppSettings,
): Promise<PomodoroState> {
  if (timer.status === 'running') {
    const now = Date.now();
    const segmentSeconds = await recordRunningSegment(timer, now);
    const paused: PomodoroState = {
      ...timer,
      status: 'paused',
      remainingSec: timer.mode === 'focus' ? remainingSeconds(timer, now) : 0,
      elapsedSec: timer.mode === 'stopwatch'
        ? Math.max(0, timer.elapsedSec ?? 0) + segmentSeconds
        : 0,
      startedAt: undefined,
      endsAt: undefined,
    };
    await browser.alarms.clear(POMODORO_ALARM);
    await saveTimer(paused);
    return paused;
  }

  const now = Date.now();
  await browser.alarms.clear(POMODORO_ALARM);

  if (timer.mode === 'stopwatch') {
    const running: PomodoroState = {
      ...timer,
      status: 'running',
      durationSec: 0,
      remainingSec: 0,
      elapsedSec: timer.status === 'idle' ? 0 : Math.max(0, timer.elapsedSec ?? 0),
      startedAt: now,
      endsAt: undefined,
      sessionId: undefined,
    };
    await saveTimer(running);
    return running;
  }

  const shouldRestart = timer.status === 'idle' || timer.remainingSec <= 0;
  const durationSec = shouldRestart
    ? durationForMode('focus', settings)
    : timer.durationSec;
  const remainingSec = shouldRestart
    ? durationSec
    : Math.max(1, timer.remainingSec);
  const endsAt = now + remainingSec * 1000;
  const running: PomodoroState = {
    ...timer,
    mode: 'focus',
    status: 'running',
    durationSec,
    remainingSec,
    elapsedSec: 0,
    startedAt: now,
    endsAt,
    sessionId: shouldRestart ? createId('session') : timer.sessionId ?? createId('session'),
  };

  await saveTimer(running);
  await browser.alarms.create(POMODORO_ALARM, { when: endsAt });
  return running;
}

export async function resetTimer(
  timer: PomodoroState,
  settings: AppSettings,
): Promise<PomodoroState> {
  const now = Date.now();
  await recordRunningSegment(timer, now);
  await browser.alarms.clear(POMODORO_ALARM);
  const durationSec = durationForMode(timer.mode, settings);
  const reset: PomodoroState = {
    ...timer,
    status: 'idle',
    durationSec,
    remainingSec: durationSec,
    elapsedSec: 0,
    startedAt: undefined,
    endsAt: undefined,
    sessionId: undefined,
  };
  await saveTimer(reset);
  return reset;
}

export async function selectMode(
  mode: PomodoroMode,
  timer: PomodoroState,
  settings: AppSettings,
): Promise<PomodoroState> {
  await recordRunningSegment(timer, Date.now());
  await browser.alarms.clear(POMODORO_ALARM);
  const durationSec = durationForMode(mode, settings);
  const next: PomodoroState = {
    mode,
    status: 'idle',
    durationSec,
    remainingSec: durationSec,
    elapsedSec: 0,
  };
  await saveTimer(next);
  return next;
}

export async function requestCompletion(sessionId?: string): Promise<void> {
  await browser.runtime.sendMessage({
    type: 'pomodoro-complete',
    sessionId,
  });
}

import { browser } from 'wxt/browser';
import type { AppSettings, PomodoroMode, PomodoroState } from './types';
import { createId } from './utils';
import { saveTimer } from './storage';

export const POMODORO_ALARM = 'page-can-pomodoro';

export function durationForMode(mode: PomodoroMode, settings: AppSettings): number {
  const minutes = mode === 'focus'
    ? settings.pomodoro.focusMinutes
    : mode === 'shortBreak'
      ? settings.pomodoro.shortBreakMinutes
      : settings.pomodoro.longBreakMinutes;
  return Math.max(1, Math.round(minutes * 60));
}

export function remainingSeconds(timer: PomodoroState): number {
  if (timer.status !== 'running' || !timer.endsAt) return timer.remainingSec;
  return Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
}

export async function toggleTimer(
  timer: PomodoroState,
  settings: AppSettings,
): Promise<PomodoroState> {
  if (timer.status === 'running') {
    const paused: PomodoroState = {
      ...timer,
      status: 'paused',
      remainingSec: remainingSeconds(timer),
      startedAt: undefined,
      endsAt: undefined,
    };
    await browser.alarms.clear(POMODORO_ALARM);
    await saveTimer(paused);
    return paused;
  }

  const durationSec = timer.status === 'idle'
    ? durationForMode(timer.mode, settings)
    : timer.durationSec;
  const remainingSec = timer.status === 'idle'
    ? durationSec
    : Math.max(1, timer.remainingSec);
  const now = Date.now();
  const endsAt = now + remainingSec * 1000;
  const running: PomodoroState = {
    ...timer,
    status: 'running',
    durationSec,
    remainingSec,
    startedAt: now,
    endsAt,
    sessionId: timer.sessionId ?? createId('session'),
  };

  await saveTimer(running);
  await browser.alarms.clear(POMODORO_ALARM);
  await browser.alarms.create(POMODORO_ALARM, { when: endsAt });
  return running;
}

export async function resetTimer(
  timer: PomodoroState,
  settings: AppSettings,
): Promise<PomodoroState> {
  await browser.alarms.clear(POMODORO_ALARM);
  const durationSec = durationForMode(timer.mode, settings);
  const reset: PomodoroState = {
    ...timer,
    status: 'idle',
    durationSec,
    remainingSec: durationSec,
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
  await browser.alarms.clear(POMODORO_ALARM);
  const durationSec = durationForMode(mode, settings);
  const next: PomodoroState = {
    ...timer,
    mode,
    status: 'idle',
    durationSec,
    remainingSec: durationSec,
    startedAt: undefined,
    endsAt: undefined,
    sessionId: undefined,
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

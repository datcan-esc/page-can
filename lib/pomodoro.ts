import { browser } from 'wxt/browser';
import {
  safeStopwatchEnd,
  STOPWATCH_CHECKIN_RESPONSE_MS,
  STOPWATCH_HEARTBEAT_INTERVAL_MINUTES,
} from './pomodoro-safety';
import { recordFocusInterval, removeFocusIntervals, replaceFocusInterval } from './stats';
import { saveTimer } from './storage';
import type {
  AppSettings,
  FocusInterval,
  PomodoroMode,
  PomodoroState,
  TimerPauseReason,
} from './types';
import { createId } from './utils';

export const POMODORO_ALARM = 'page-can-pomodoro';
export const STOPWATCH_HEARTBEAT_ALARM = 'page-can-stopwatch-heartbeat';
export const STOPWATCH_CHECKIN_ALARM = 'page-can-stopwatch-checkin';
export const STOPWATCH_CHECKIN_TIMEOUT_ALARM = 'page-can-stopwatch-checkin-timeout';
export const STOPWATCH_CHECKIN_NOTIFICATION = 'page-can-stopwatch-checkin';

const STOPWATCH_ALARMS = [
  STOPWATCH_HEARTBEAT_ALARM,
  STOPWATCH_CHECKIN_ALARM,
  STOPWATCH_CHECKIN_TIMEOUT_ALARM,
];

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
  return stored + Math.max(0, Math.floor((safeStopwatchEnd(timer, now) - timer.startedAt) / 1000));
}

function nextCheckInAt(settings: AppSettings, now: number): number | undefined {
  const minutes = settings.pomodoro.checkInMinutes;
  return minutes > 0 ? now + minutes * 60 * 1000 : undefined;
}

async function clearAlarms(names: string[]): Promise<void> {
  await Promise.all(names.map((name) => browser.alarms.clear(name)));
}

export async function clearStopwatchAlarms(): Promise<void> {
  await clearAlarms(STOPWATCH_ALARMS);
}

async function clearAllTimerAlarms(): Promise<void> {
  await clearAlarms([POMODORO_ALARM, ...STOPWATCH_ALARMS]);
  await browser.notifications.clear(STOPWATCH_CHECKIN_NOTIFICATION);
}

export async function syncStopwatchAlarms(
  timer: PomodoroState,
  settings: AppSettings,
): Promise<void> {
  await clearStopwatchAlarms();
  if (timer.mode !== 'stopwatch' || timer.status !== 'running') return;

  await browser.alarms.create(STOPWATCH_HEARTBEAT_ALARM, {
    delayInMinutes: STOPWATCH_HEARTBEAT_INTERVAL_MINUTES,
    periodInMinutes: STOPWATCH_HEARTBEAT_INTERVAL_MINUTES,
  });

  if (settings.pomodoro.checkInMinutes <= 0) return;
  if (timer.checkInPromptedAt) {
    await browser.alarms.create(STOPWATCH_CHECKIN_TIMEOUT_ALARM, {
      when: Math.max(Date.now() + 1000, timer.checkInPromptedAt + STOPWATCH_CHECKIN_RESPONSE_MS),
    });
    return;
  }

  const checkInAt = timer.checkInAt ?? nextCheckInAt(settings, Date.now());
  if (checkInAt) {
    await browser.alarms.create(STOPWATCH_CHECKIN_ALARM, {
      when: Math.max(Date.now() + 1000, checkInAt),
    });
  }
}

interface RecordedSegment {
  seconds: number;
  interval?: FocusInterval;
}

async function recordRunningSegment(
  timer: PomodoroState,
  requestedEnd: number,
): Promise<RecordedSegment> {
  if (timer.status !== 'running' || !timer.startedAt) return { seconds: 0 };
  const end = timer.mode === 'focus' && timer.endsAt
    ? Math.min(requestedEnd, timer.endsAt)
    : timer.mode === 'stopwatch'
      ? Math.min(requestedEnd, safeStopwatchEnd(timer, requestedEnd))
      : requestedEnd;
  if (end <= timer.startedAt) return { seconds: 0 };
  await recordFocusInterval(timer.startedAt, end);
  return {
    seconds: Math.max(0, Math.floor((end - timer.startedAt) / 1000)),
    interval: { startAt: timer.startedAt, endAt: end },
  };
}

function appendSegment(
  segments: FocusInterval[] | undefined,
  interval: FocusInterval | undefined,
): FocusInterval[] | undefined {
  if (!interval) return segments?.length ? segments : undefined;
  return [...(segments ?? []), interval].slice(-128);
}

function idleTimer(mode: PomodoroMode, settings: AppSettings): PomodoroState {
  const durationSec = durationForMode(mode, settings);
  return {
    mode,
    status: 'idle',
    durationSec,
    remainingSec: durationSec,
    elapsedSec: 0,
  };
}

export async function toggleTimer(
  timer: PomodoroState,
  settings: AppSettings,
): Promise<PomodoroState> {
  if (timer.status === 'running') {
    const now = Date.now();
    const segment = await recordRunningSegment(timer, now);
    const paused: PomodoroState = {
      ...timer,
      status: 'paused',
      remainingSec: timer.mode === 'focus' ? remainingSeconds(timer, now) : 0,
      elapsedSec: timer.mode === 'stopwatch'
        ? Math.max(0, timer.elapsedSec ?? 0) + segment.seconds
        : 0,
      startedAt: undefined,
      endsAt: undefined,
      lastHeartbeatAt: undefined,
      checkInAt: undefined,
      checkInPromptedAt: undefined,
      segments: timer.mode === 'stopwatch'
        ? appendSegment(timer.segments, segment.interval)
        : undefined,
      recovery: undefined,
    };
    await clearAllTimerAlarms();
    await saveTimer(paused);
    return paused;
  }

  const now = Date.now();
  await clearAllTimerAlarms();

  if (timer.mode === 'stopwatch') {
    const isNewSession = timer.status === 'idle';
    const running: PomodoroState = {
      mode: 'stopwatch',
      status: 'running',
      durationSec: 0,
      remainingSec: 0,
      elapsedSec: isNewSession ? 0 : Math.max(0, timer.elapsedSec ?? 0),
      startedAt: now,
      sessionId: isNewSession ? createId('session') : timer.sessionId ?? createId('session'),
      lastHeartbeatAt: now,
      checkInAt: nextCheckInAt(settings, now),
      segments: isNewSession ? undefined : timer.segments,
    };
    await saveTimer(running);
    await syncStopwatchAlarms(running, settings);
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

export async function finishTimer(
  timer: PomodoroState,
  settings: AppSettings,
): Promise<PomodoroState> {
  if (timer.mode !== 'stopwatch') return resetTimer(timer, settings);
  if (timer.status === 'running') await recordRunningSegment(timer, Date.now());
  await clearAllTimerAlarms();
  const next = idleTimer('stopwatch', settings);
  await saveTimer(next);
  return next;
}

export async function discardTimer(
  timer: PomodoroState,
  settings: AppSettings,
): Promise<PomodoroState> {
  if (timer.mode === 'stopwatch' && timer.segments?.length) {
    await removeFocusIntervals(timer.segments);
  }
  await clearAllTimerAlarms();
  const next = idleTimer(timer.mode, settings);
  await saveTimer(next);
  return next;
}

export async function resetTimer(
  timer: PomodoroState,
  settings: AppSettings,
): Promise<PomodoroState> {
  if (timer.mode === 'stopwatch') return discardTimer(timer, settings);
  await recordRunningSegment(timer, Date.now());
  await clearAllTimerAlarms();
  const reset = idleTimer(timer.mode, settings);
  await saveTimer(reset);
  return reset;
}

export async function selectMode(
  mode: PomodoroMode,
  timer: PomodoroState,
  settings: AppSettings,
): Promise<PomodoroState> {
  await recordRunningSegment(timer, Date.now());
  await clearAllTimerAlarms();
  const next = idleTimer(mode, settings);
  await saveTimer(next);
  return next;
}

export async function autoPauseStopwatch(
  timer: PomodoroState,
  requestedEnd: number,
  reason: TimerPauseReason,
  detectedAt = Date.now(),
): Promise<PomodoroState> {
  if (timer.mode !== 'stopwatch' || timer.status !== 'running' || !timer.startedAt) return timer;
  const endAt = Math.max(
    timer.startedAt,
    Math.min(requestedEnd, detectedAt, safeStopwatchEnd(timer, detectedAt)),
  );
  const segment = await recordRunningSegment(timer, endAt);
  const paused: PomodoroState = {
    ...timer,
    status: 'paused',
    elapsedSec: Math.max(0, timer.elapsedSec ?? 0) + segment.seconds,
    startedAt: undefined,
    endsAt: undefined,
    lastHeartbeatAt: undefined,
    checkInAt: undefined,
    checkInPromptedAt: undefined,
    segments: appendSegment(timer.segments, segment.interval),
    recovery: {
      reason,
      segmentStartAt: timer.startedAt,
      recordedEndAt: endAt,
      detectedAt,
      excludedSec: Math.max(0, Math.floor((detectedAt - endAt) / 1000)),
    },
  };
  await clearStopwatchAlarms();
  await saveTimer(paused);
  return paused;
}

export async function adjustRecoveredStopwatch(
  timer: PomodoroState,
  requestedEnd: number,
): Promise<PomodoroState> {
  const recovery = timer.recovery;
  if (timer.mode !== 'stopwatch' || timer.status !== 'paused' || !recovery) return timer;
  const endAt = Math.max(recovery.segmentStartAt, Math.min(requestedEnd, recovery.detectedAt));
  const previous = recovery.recordedEndAt > recovery.segmentStartAt
    ? { startAt: recovery.segmentStartAt, endAt: recovery.recordedEndAt }
    : undefined;
  const nextInterval = endAt > recovery.segmentStartAt
    ? { startAt: recovery.segmentStartAt, endAt }
    : undefined;
  await replaceFocusInterval(previous, nextInterval);

  const segments = [...(timer.segments ?? [])];
  let previousIndex = -1;
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const candidate = segments[index];
    if (
      candidate?.startAt === recovery.segmentStartAt
      && candidate.endAt === recovery.recordedEndAt
    ) {
      previousIndex = index;
      break;
    }
  }
  if (previousIndex >= 0) segments.splice(previousIndex, 1);
  if (nextInterval) segments.push(nextInterval);

  const previousSeconds = Math.floor((recovery.recordedEndAt - recovery.segmentStartAt) / 1000);
  const nextSeconds = Math.floor((endAt - recovery.segmentStartAt) / 1000);
  const updated: PomodoroState = {
    ...timer,
    elapsedSec: Math.max(0, timer.elapsedSec + nextSeconds - previousSeconds),
    segments: segments.length ? segments.slice(-128) : undefined,
    recovery: {
      ...recovery,
      recordedEndAt: endAt,
      excludedSec: Math.max(0, Math.floor((recovery.detectedAt - endAt) / 1000)),
    },
  };
  await saveTimer(updated);
  return updated;
}

export async function refreshStopwatchHeartbeat(
  timer: PomodoroState,
  now = Date.now(),
): Promise<PomodoroState> {
  if (timer.mode !== 'stopwatch' || timer.status !== 'running') return timer;
  const updated = { ...timer, lastHeartbeatAt: now };
  await saveTimer(updated);
  return updated;
}

export async function markStopwatchCheckInPrompted(
  timer: PomodoroState,
  promptedAt = Date.now(),
): Promise<PomodoroState> {
  if (timer.mode !== 'stopwatch' || timer.status !== 'running') return timer;
  const updated = { ...timer, checkInPromptedAt: promptedAt };
  await saveTimer(updated);
  await browser.alarms.clear(STOPWATCH_CHECKIN_ALARM);
  await browser.alarms.create(STOPWATCH_CHECKIN_TIMEOUT_ALARM, {
    when: promptedAt + STOPWATCH_CHECKIN_RESPONSE_MS,
  });
  return updated;
}

export async function confirmStopwatchCheckIn(
  timer: PomodoroState,
  settings: AppSettings,
  now = Date.now(),
): Promise<PomodoroState> {
  if (timer.mode !== 'stopwatch' || timer.status !== 'running') return timer;
  const updated: PomodoroState = {
    ...timer,
    lastHeartbeatAt: now,
    checkInAt: nextCheckInAt(settings, now),
    checkInPromptedAt: undefined,
  };
  await saveTimer(updated);
  await syncStopwatchAlarms(updated, settings);
  return updated;
}

export async function requestCompletion(sessionId?: string): Promise<void> {
  await browser.runtime.sendMessage({
    type: 'pomodoro-complete',
    sessionId,
  });
}

export async function requestTimerReconciliation(): Promise<void> {
  await browser.runtime.sendMessage({ type: 'pomodoro-reconcile' });
}

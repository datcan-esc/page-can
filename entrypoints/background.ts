import { browser } from 'wxt/browser';
import { durationForMode, POMODORO_ALARM } from '../lib/pomodoro';
import { loadSettings, loadStats, loadTimer, saveStats, saveTimer } from '../lib/storage';
import type { PomodoroMode, PomodoroState } from '../lib/types';
import { createId, localDateKey } from '../lib/utils';

export default defineBackground(() => {
  let completionQueue = Promise.resolve();

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== POMODORO_ALARM) return;
    completionQueue = completionQueue.then(() => completeSession());
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    const parsed = message as { type?: string; sessionId?: string };
    if (parsed.type !== 'pomodoro-complete') return undefined;
    completionQueue = completionQueue.then(() => completeSession(parsed.sessionId));
    return completionQueue;
  });
});

async function completeSession(requestedSessionId?: string): Promise<void> {
  const [timer, settings, stats] = await Promise.all([
    loadTimer(),
    loadSettings(),
    loadStats(),
  ]);

  if (timer.status !== 'running' || !timer.sessionId) return;
  if (requestedSessionId && timer.sessionId !== requestedSessionId) return;
  if (timer.endsAt && timer.endsAt > Date.now() + 1000) return;

  if (timer.mode === 'focus') {
    const today = localDateKey();
    const existing = stats.find((item) => item.date === today);
    if (existing) {
      existing.focusSeconds += timer.durationSec;
      existing.completedSessions += 1;
    } else {
      stats.push({
        date: today,
        focusSeconds: timer.durationSec,
        completedSessions: 1,
      });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 31);
    await saveStats(stats.filter((item) => item.date >= localDateKey(cutoff)));
  }

  const completedFocusCycle = timer.mode === 'focus'
    ? timer.focusCycle + 1
    : timer.focusCycle;
  const nextMode = getNextMode(timer.mode, completedFocusCycle);
  const shouldAutoStart = nextMode === 'focus'
    ? settings.pomodoro.autoStartFocus
    : settings.pomodoro.autoStartBreaks;
  const nextDuration = durationForMode(nextMode, settings);
  const nextTimer: PomodoroState = {
    mode: nextMode,
    status: shouldAutoStart ? 'running' : 'idle',
    durationSec: nextDuration,
    remainingSec: nextDuration,
    focusCycle: completedFocusCycle,
  };

  if (shouldAutoStart) {
    const now = Date.now();
    nextTimer.startedAt = now;
    nextTimer.endsAt = now + nextDuration * 1000;
    nextTimer.sessionId = createId('session');
  }

  await saveTimer(nextTimer);

  if (shouldAutoStart && nextTimer.endsAt) {
    await browser.alarms.create(POMODORO_ALARM, { when: nextTimer.endsAt });
  }

  await browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
    title: timer.mode === 'focus' ? 'Odak tamamlandı' : 'Mola tamamlandı',
    message: nextMode === 'focus' ? 'Yeni bir odak seansına hazırsın.' : 'Kısa bir mola iyi gelecek.',
  });
}

function getNextMode(mode: PomodoroMode, focusCycle: number): PomodoroMode {
  if (mode !== 'focus') return 'focus';
  return focusCycle % 4 === 0 ? 'longBreak' : 'shortBreak';
}

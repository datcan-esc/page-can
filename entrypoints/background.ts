import { browser } from 'wxt/browser';
import { durationForMode, POMODORO_ALARM } from '../lib/pomodoro';
import { recordFocusInterval } from '../lib/stats';
import { loadSettings, loadTimer, saveTimer } from '../lib/storage';
import type { PomodoroState } from '../lib/types';

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
  const [timer, settings] = await Promise.all([loadTimer(), loadSettings()]);

  if (timer.mode !== 'focus' || timer.status !== 'running' || !timer.sessionId) return;
  if (requestedSessionId && timer.sessionId !== requestedSessionId) return;
  if (timer.endsAt && timer.endsAt > Date.now() + 1000) return;

  const completedAt = Math.min(Date.now(), timer.endsAt ?? Date.now());
  if (timer.startedAt) {
    await recordFocusInterval(timer.startedAt, completedAt, true);
  }

  const durationSec = durationForMode('focus', settings);
  const nextTimer: PomodoroState = {
    mode: 'focus',
    status: 'idle',
    durationSec,
    remainingSec: durationSec,
    elapsedSec: 0,
  };
  await saveTimer(nextTimer);

  await browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
    title: 'Odak tamamlandı',
    message: 'Odak süren kaydedildi.',
  });
}

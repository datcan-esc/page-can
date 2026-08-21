import { browser } from 'wxt/browser';
import {
  autoPauseStopwatch,
  confirmStopwatchCheckIn,
  durationForMode,
  finishTimer,
  markStopwatchCheckInPrompted,
  POMODORO_ALARM,
  refreshStopwatchHeartbeat,
  STOPWATCH_CHECKIN_ALARM,
  STOPWATCH_CHECKIN_NOTIFICATION,
  STOPWATCH_CHECKIN_TIMEOUT_ALARM,
  STOPWATCH_HEARTBEAT_ALARM,
  syncStopwatchAlarms,
} from '../lib/pomodoro';
import {
  STOPWATCH_CHECKIN_RESPONSE_MS,
  STOPWATCH_STALE_AFTER_MS,
} from '../lib/pomodoro-safety';
import { recordFocusInterval } from '../lib/stats';
import { loadSettings, loadTimer, saveTimer, storageKeys } from '../lib/storage';
import type { PomodoroState, TimerPauseReason } from '../lib/types';

const AUTO_PAUSE_NOTIFICATION = 'page-can-stopwatch-auto-paused';

export default defineBackground(() => {
  let operationQueue = Promise.resolve();

  const enqueue = (operation: () => Promise<void>) => {
    operationQueue = operationQueue
      .catch(() => undefined)
      .then(operation)
      .catch((error) => {
        console.error('Odak sayacı güncellenirken hata oluştu.', error);
      });
    return operationQueue;
  };

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === POMODORO_ALARM) {
      void enqueue(() => completeSession());
    } else if (alarm.name === STOPWATCH_HEARTBEAT_ALARM) {
      void enqueue(reconcileStopwatch);
    } else if (alarm.name === STOPWATCH_CHECKIN_ALARM) {
      void enqueue(promptStopwatchCheckIn);
    } else if (alarm.name === STOPWATCH_CHECKIN_TIMEOUT_ALARM) {
      void enqueue(pauseAfterMissedCheckIn);
    }
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    const parsed = message as { type?: string; sessionId?: string };
    if (parsed.type === 'pomodoro-complete') {
      return enqueue(() => completeSession(parsed.sessionId));
    }
    if (parsed.type === 'pomodoro-reconcile') return enqueue(reconcileStopwatch);
    return undefined;
  });

  browser.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId !== STOPWATCH_CHECKIN_NOTIFICATION) return;
    void enqueue(() => handleCheckInAction(buttonIndex));
  });

  browser.idle.onStateChanged.addListener((state) => {
    if (state === 'active') return;
    void enqueue(() => pauseForIdleState(state));
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[storageKeys.settings]) return;
    void enqueue(async () => {
      await configureIdleDetection();
      await rescheduleCheckInAfterSettingsChange();
    });
  });

  void enqueue(async () => {
    await configureIdleDetection();
    await reconcileStopwatch();
  });
});

async function configureIdleDetection(): Promise<void> {
  const settings = await loadSettings();
  const seconds = settings.pomodoro.idleMinutes > 0
    ? settings.pomodoro.idleMinutes * 60
    : 60;
  browser.idle.setDetectionInterval(Math.max(15, seconds));
}

async function rescheduleCheckInAfterSettingsChange(): Promise<void> {
  const [timer, settings] = await Promise.all([loadTimer(), loadSettings()]);
  if (timer.mode !== 'stopwatch' || timer.status !== 'running') return;
  const now = Date.now();
  const updated: PomodoroState = {
    ...timer,
    checkInAt: settings.pomodoro.checkInMinutes > 0
      ? now + settings.pomodoro.checkInMinutes * 60 * 1000
      : undefined,
    checkInPromptedAt: undefined,
  };
  await saveTimer(updated);
  await browser.notifications.clear(STOPWATCH_CHECKIN_NOTIFICATION);
  await syncStopwatchAlarms(updated, settings);
}

async function notifyAutoPause(reason: TimerPauseReason): Promise<void> {
  const messages: Record<TimerPauseReason, string> = {
    offline: 'Tarayıcı veya bilgisayar kapalıyken geçen süre kaydedilmedi.',
    idle: 'Hareketsizlikte geçen süre kaydedilmedi.',
    locked: 'Ekran kilitlendiğinde sayaç duraklatıldı.',
    checkin: 'Kontrol bildirimine yanıt gelmediği için sayaç duraklatıldı.',
  };
  await browser.notifications.create(AUTO_PAUSE_NOTIFICATION, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
    title: 'Sayaç otomatik duraklatıldı',
    message: messages[reason],
  });
}

async function reconcileStopwatch(): Promise<void> {
  const [timer, settings] = await Promise.all([loadTimer(), loadSettings()]);
  if (timer.mode !== 'stopwatch' || timer.status !== 'running' || !timer.startedAt) return;
  const now = Date.now();

  if (
    timer.checkInPromptedAt
    && now - timer.checkInPromptedAt >= STOPWATCH_CHECKIN_RESPONSE_MS
  ) {
    await autoPauseStopwatch(timer, timer.checkInPromptedAt, 'checkin', now);
    await browser.notifications.clear(STOPWATCH_CHECKIN_NOTIFICATION);
    await notifyAutoPause('checkin');
    return;
  }

  const verifiedAt = timer.lastHeartbeatAt ?? timer.startedAt;
  if (now - verifiedAt > STOPWATCH_STALE_AFTER_MS) {
    await autoPauseStopwatch(timer, verifiedAt, 'offline', now);
    await browser.notifications.clear(STOPWATCH_CHECKIN_NOTIFICATION);
    await notifyAutoPause('offline');
    return;
  }

  const updated = await refreshStopwatchHeartbeat(timer, now);
  await syncStopwatchAlarms(updated, settings);
  if (!updated.checkInPromptedAt && updated.checkInAt && updated.checkInAt <= now) {
    await promptStopwatchCheckIn();
  }
}

async function promptStopwatchCheckIn(): Promise<void> {
  const [timer, settings] = await Promise.all([loadTimer(), loadSettings()]);
  if (
    timer.mode !== 'stopwatch'
    || timer.status !== 'running'
    || timer.checkInPromptedAt
    || settings.pomodoro.checkInMinutes <= 0
  ) return;

  const promptedAt = Date.now();
  await markStopwatchCheckInPrompted(timer, promptedAt);
  await browser.notifications.create(STOPWATCH_CHECKIN_NOTIFICATION, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
    title: 'Hâlâ odakta mısın?',
    message: `Sayaç ${settings.pomodoro.checkInMinutes} dakikadır açık.`,
    requireInteraction: true,
    buttons: [
      { title: 'Devam ediyorum' },
      { title: 'Bitir ve kaydet' },
    ],
  });
}

async function pauseAfterMissedCheckIn(): Promise<void> {
  const timer = await loadTimer();
  if (timer.mode !== 'stopwatch' || timer.status !== 'running' || !timer.checkInPromptedAt) return;
  await autoPauseStopwatch(timer, timer.checkInPromptedAt, 'checkin', Date.now());
  await browser.notifications.clear(STOPWATCH_CHECKIN_NOTIFICATION);
  await notifyAutoPause('checkin');
}

async function handleCheckInAction(buttonIndex: number): Promise<void> {
  const [timer, settings] = await Promise.all([loadTimer(), loadSettings()]);
  if (timer.mode !== 'stopwatch' || timer.status !== 'running') {
    await browser.notifications.clear(STOPWATCH_CHECKIN_NOTIFICATION);
    return;
  }

  if (buttonIndex === 0) {
    await confirmStopwatchCheckIn(timer, settings);
  } else if (buttonIndex === 1) {
    await finishTimer(timer, settings);
    await browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
      title: 'Odak kaydedildi',
      message: 'Sayaç durduruldu ve çalışma süren kaydedildi.',
    });
  }
  await browser.notifications.clear(STOPWATCH_CHECKIN_NOTIFICATION);
}

async function pauseForIdleState(state: 'idle' | 'locked'): Promise<void> {
  const [timer, settings] = await Promise.all([loadTimer(), loadSettings()]);
  if (timer.mode !== 'stopwatch' || timer.status !== 'running' || !timer.startedAt) return;
  if (state === 'idle' && settings.pomodoro.idleMinutes <= 0) return;

  const now = Date.now();
  const endAt = state === 'idle'
    ? Math.max(timer.startedAt, now - settings.pomodoro.idleMinutes * 60 * 1000)
    : now;
  const reason: TimerPauseReason = state === 'idle' ? 'idle' : 'locked';
  await autoPauseStopwatch(timer, endAt, reason, now);
  await browser.notifications.clear(STOPWATCH_CHECKIN_NOTIFICATION);
  await notifyAutoPause(reason);
}

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

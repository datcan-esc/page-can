import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

async function createPomodoroHarness(initialState = {}) {
  const state = {
    local: structuredClone(initialState.local ?? {}),
    sync: structuredClone(initialState.sync ?? {}),
    bookmarks: { recent: [], tree: [] },
    calls: { getRecent: 0, getTree: 0 },
    storageGets: { local: [], sync: [] },
    alarms: {},
    sentMessages: [],
  };
  globalThis.__pageCanStorageTestState = state;

  const server = await createServer({
    configFile: false,
    appType: 'custom',
    resolve: {
      alias: {
        'wxt/browser': fileURLToPath(new URL('./browser.mock.mjs', import.meta.url)),
      },
    },
    server: { middlewareMode: true, hmr: false, ws: false },
  });

  const pomodoro = await server.ssrLoadModule('/lib/pomodoro.ts');
  const safety = await server.ssrLoadModule('/lib/pomodoro-safety.ts');
  const stats = await server.ssrLoadModule('/lib/stats.ts');
  const storage = await server.ssrLoadModule('/lib/storage.ts');
  return {
    state,
    pomodoro,
    safety,
    stats,
    storage,
    async close() {
      await server.close();
      delete globalThis.__pageCanStorageTestState;
    },
  };
}

function totalFocusSeconds(stats) {
  return stats.reduce((total, item) => total + item.focusSeconds, 0);
}

test('sınırsız sayaç güvenli zaman kaydı', async (t) => {
  await t.test('canlı süreyi son heartbeat sonrasında sınırlar', async () => {
    const harness = await createPomodoroHarness();
    try {
      const startedAt = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const lastHeartbeatAt = startedAt + 60_000;
      const timer = {
        mode: 'stopwatch',
        status: 'running',
        durationSec: 0,
        remainingSec: 0,
        elapsedSec: 30,
        startedAt,
        lastHeartbeatAt,
      };
      assert.equal(
        harness.pomodoro.elapsedSeconds(timer, Date.now()),
        30 + 60 + harness.safety.STOPWATCH_STALE_AFTER_MS / 1000,
      );
    } finally {
      await harness.close();
    }
  });

  await t.test('başlatınca heartbeat ve kontrol alarmlarını kurar, duraklatınca temizler', async () => {
    const harness = await createPomodoroHarness();
    try {
      const settings = await harness.storage.loadSettings();
      const idle = {
        mode: 'stopwatch',
        status: 'idle',
        durationSec: 0,
        remainingSec: 0,
        elapsedSec: 0,
      };
      const running = await harness.pomodoro.toggleTimer(idle, settings);
      assert.equal(running.status, 'running');
      assert.ok(running.sessionId);
      assert.ok(harness.state.alarms[harness.pomodoro.STOPWATCH_HEARTBEAT_ALARM]);
      assert.ok(harness.state.alarms[harness.pomodoro.STOPWATCH_CHECKIN_ALARM]);

      const paused = await harness.pomodoro.toggleTimer(running, settings);
      assert.equal(paused.status, 'paused');
      assert.deepEqual(harness.state.alarms, {});
    } finally {
      await harness.close();
    }
  });

  await t.test('kapanma boşluğunu kaydetmeden son heartbeat noktasında duraklatır', async () => {
    const startedAt = Date.now() - 10 * 60_000;
    const lastHeartbeatAt = startedAt + 60_000;
    const harness = await createPomodoroHarness({
      local: {
        pomodoroState: {
          mode: 'stopwatch',
          status: 'running',
          durationSec: 0,
          remainingSec: 0,
          elapsedSec: 0,
          startedAt,
          lastHeartbeatAt,
          sessionId: 'session-test',
        },
      },
    });
    try {
      const timer = await harness.storage.loadTimer();
      const paused = await harness.pomodoro.autoPauseStopwatch(
        timer,
        lastHeartbeatAt,
        'offline',
        Date.now(),
      );
      assert.equal(paused.status, 'paused');
      assert.equal(paused.elapsedSec, 60);
      assert.equal(paused.recovery.reason, 'offline');
      assert.equal(paused.recovery.recordedEndAt, lastHeartbeatAt);
      assert.equal(totalFocusSeconds(await harness.storage.loadStats()), 60);
    } finally {
      await harness.close();
    }
  });

  await t.test('kurtarılan oturumun bitişini değiştirir ve tüm oturumu geri alabilir', async () => {
    const startedAt = Date.now() - 10 * 60_000;
    const firstEnd = startedAt + 60_000;
    const correctedEnd = startedAt + 90_000;
    const harness = await createPomodoroHarness();
    try {
      const running = {
        mode: 'stopwatch',
        status: 'running',
        durationSec: 0,
        remainingSec: 0,
        elapsedSec: 0,
        startedAt,
        lastHeartbeatAt: firstEnd,
        sessionId: 'session-test',
      };
      const paused = await harness.pomodoro.autoPauseStopwatch(
        running,
        firstEnd,
        'offline',
        Date.now(),
      );
      const corrected = await harness.pomodoro.adjustRecoveredStopwatch(paused, correctedEnd);
      assert.equal(corrected.elapsedSec, 90);
      assert.equal(corrected.recovery.recordedEndAt, correctedEnd);
      assert.equal(totalFocusSeconds(await harness.storage.loadStats()), 90);

      const settings = await harness.storage.loadSettings();
      const discarded = await harness.pomodoro.discardTimer(corrected, settings);
      assert.equal(discarded.status, 'idle');
      assert.equal(totalFocusSeconds(await harness.storage.loadStats()), 0);
    } finally {
      await harness.close();
    }
  });

  await t.test('günlük toplamı elle düzeltir veya siler', async () => {
    const harness = await createPomodoroHarness();
    try {
      const today = new Date();
      const key = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');
      await harness.stats.setDailyFocusSeconds(key, 7200);
      assert.equal(totalFocusSeconds(await harness.storage.loadStats()), 7200);
      await harness.stats.setDailyFocusSeconds(key, 0);
      assert.equal(totalFocusSeconds(await harness.storage.loadStats()), 0);
    } finally {
      await harness.close();
    }
  });
});

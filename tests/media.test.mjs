import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('medya süre yardımcıları', async (t) => {
  const server = await createServer({
    configFile: false,
    appType: 'custom',
    resolve: {
      alias: {
        'wxt/browser': fileURLToPath(new URL('./media-browser.mock.mjs', import.meta.url)),
      },
    },
    server: { middlewareMode: true, hmr: false, ws: false },
  });

  try {
    const media = await server.ssrLoadModule('/lib/media.ts');

    await t.test('oynatıcı metnindeki son değeri toplam süre olarak okur', () => {
      assert.equal(media.parseMediaDurationText('1:24 / 4:08'), 248);
      assert.equal(media.parseMediaDurationText('0:14 / 1:02:03'), 3723);
      assert.equal(media.parseMediaDurationText('4:08'), 248);
    });

    await t.test('geçen ve toplam süreyi aynı şarkı zamanından okur', () => {
      assert.deepEqual(
        media.parseMediaTimeText('1:24 / 4:08'),
        { currentTime: 84, duration: 248 },
      );
      assert.deepEqual(
        media.parseMediaTimeText('4:08'),
        { currentTime: null, duration: 248 },
      );
    });

    await t.test('birikimli video zamanını şarkı zamanına çevirir', () => {
      assert.equal(media.mediaTimelineOffset(185.4, 5.4), 180);
      assert.equal(media.mediaTimelineOffset(42.6, 42), 0);
      assert.equal(media.mediaTimelineOffset(42.6, null), 0);
    });

    await t.test('ana sayfa oynatıcı zaman mesajını doğrular', () => {
      const message = {
        type: media.YOUTUBE_PLAYER_STATE,
        state: {
          videoId: 'video-id',
          title: 'Yeni şarkı',
          artist: 'Sanatçı',
          currentTime: 4.5,
          duration: 213,
          updatedAt: Date.now(),
        },
      };
      assert.equal(media.isYouTubePlayerStateMessage(message), true);
      assert.equal(
        media.isYouTubePlayerStateMessage({
          ...message,
          bridgeVersion: media.YOUTUBE_PLAYER_BRIDGE_VERSION,
        }),
        true,
      );
      assert.equal(
        media.isYouTubePlayerStateMessage({ ...message, bridgeVersion: -1 }),
        false,
      );
      assert.equal(
        media.isYouTubePlayerStateMessage({
          ...message,
          state: { ...message.state, duration: Number.NaN },
        }),
        false,
      );
      assert.equal(
        media.isYouTubePlayerSeekMessage({ type: media.YOUTUBE_PLAYER_SEEK, time: 72 }),
        true,
      );
    });

    await t.test('otomatik parça geçişindeki saat sıfırlamasını anında raporlar', () => {
      const previous = {
        videoId: 'same-id',
        title: 'Aynı başlık',
        artist: 'Sanatçı',
        currentTime: 212,
        duration: 213,
        updatedAt: 1,
      };
      assert.equal(
        media.shouldForcePlayerTimingReport(previous, {
          ...previous,
          currentTime: 0,
          duration: 189,
          updatedAt: 2,
        }),
        true,
      );
      assert.equal(
        media.shouldForcePlayerTimingReport(previous, {
          ...previous,
          currentTime: 211.5,
          updatedAt: 2,
        }),
        false,
      );
    });

    await t.test('gapless zaman çizgisini yeni parçada sıfıra çevirir', () => {
      const oldTrack = media.resolveMediaTrackClock(null, 'old-track', 179, 0);
      const transition = media.resolveMediaTrackClock(
        oldTrack,
        'new-track',
        178,
        180,
      );
      const continued = media.resolveMediaTrackClock(
        transition,
        'new-track',
        181,
        0,
      );
      assert.equal(transition.currentTime, 0);
      assert.equal(transition.offset, 180);
      assert.equal(continued.currentTime, 1);
    });

    await t.test('aynı parçadaki küçük örnekleme gerilemesini görünür kılmaz', () => {
      assert.equal(media.stabilizeMediaCurrentTime(42.8, 42, true), 42.8);
      assert.equal(media.stabilizeMediaCurrentTime(42.8, 12, true), 12);
      assert.equal(media.stabilizeMediaCurrentTime(42.8, 0, false), 0);
    });

    await t.test('YouTube Music parça saatini okur ve ileri sarmayı gerçek oynatıcıya iletir', async () => {
      const globalNames = ['defineContentScript', 'window', 'document', 'location'];
      const originalDescriptors = new Map(globalNames.map((name) => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name),
      ]));
      const messages = [];
      let intervalCallback = () => undefined;
      let messageListener = null;
      let nextIntervalId = 0;
      const clearedIntervals = [];
      const seekCalls = [];
      const playerApi = {
        getProgressState: () => ({ current: 214, duration: 400, seekableEnd: 400 }),
        getVideoData: () => ({
          video_id: 'track-id',
          title: 'Parça',
          author: 'Sanatçı',
        }),
        getVideoUrl: () => 'https://music.youtube.com/watch?v=track-id',
      };
      const moviePlayer = {
        getCurrentTime: () => progressBar.current,
        getVideoData: playerApi.getVideoData,
        seekTo(seconds, allowSeekAhead) {
          seekCalls.push({ seconds, allowSeekAhead });
        },
      };
      const progressBar = {
        value: 214,
        max: 400,
        current: 4,
        duration: 180,
        getAttribute(name) {
          if (name === 'aria-valuenow') return String(this.current);
          if (name === 'aria-valuemax') return String(this.duration);
          return null;
        },
      };
      const playerBar = {
        currentSeconds: 4,
        seekableEndSeconds: 180,
        currentItem: {
          videoId: 'track-id',
          title: { runs: [{ text: 'Parça' }] },
          shortBylineText: { runs: [{ text: 'Sanatçı' }] },
          lengthText: { runs: [{ text: '3:00' }] },
        },
        playerApi,
        querySelector(selector) {
          if (selector === '#progress-bar') return progressBar;
          if (selector === '.title') return { textContent: 'Parça' };
          if (selector === '.byline') return { textContent: 'Sanatçı' };
          return null;
        },
      };

      try {
        globalThis.defineContentScript = (value) => value;
        globalThis.location = {
          hostname: 'music.youtube.com',
          origin: 'https://music.youtube.com',
          href: 'https://music.youtube.com/watch?v=track-id',
        };
        globalThis.document = {
          querySelector(selector) {
            if (selector === 'ytmusic-player-bar') return playerBar;
            if (selector === 'ytmusic-player #movie_player') return moviePlayer;
            return null;
          },
        };
        globalThis.window = {
          addEventListener(type, listener) {
            if (type === 'message') messageListener = listener;
          },
          removeEventListener(type, listener) {
            if (type === 'message' && messageListener === listener) messageListener = null;
          },
          postMessage: (message) => messages.push(message),
          setInterval(callback) {
            intervalCallback = callback;
            return ++nextIntervalId;
          },
          clearInterval(id) { clearedIntervals.push(id); },
          setTimeout: () => undefined,
        };

        const bridge = await server.ssrLoadModule('/entrypoints/youtube-player-main.content.ts');
        bridge.default.main();
        assert.equal(messages.at(-1).state.currentTime, 4);
        assert.equal(messages.at(-1).state.duration, 180);
        assert.equal(
          messages.at(-1).bridgeVersion,
          media.YOUTUBE_PLAYER_BRIDGE_VERSION,
        );

        const firstBridge = globalThis.window.__pageCanYouTubePlayerBridge;
        bridge.default.main();
        assert.notEqual(globalThis.window.__pageCanYouTubePlayerBridge, firstBridge);
        assert.deepEqual(clearedIntervals, [1]);
        assert.equal(typeof messageListener, 'function');

        messageListener({
          source: globalThis.window,
          origin: globalThis.location.origin,
          data: { type: media.YOUTUBE_PLAYER_SEEK, time: 90 },
        });
        assert.deepEqual(seekCalls, [{ seconds: 90, allowSeekAhead: true }]);

        progressBar.current = 179;
        intervalCallback();
        assert.equal(messages.at(-1).state.currentTime, 179);

        playerBar.currentItem = {
          videoId: 'next-track-id',
          title: { runs: [{ text: 'Sonraki parça' }] },
          shortBylineText: { runs: [{ text: 'Diğer sanatçı' }] },
          lengthText: { runs: [{ text: '3:25' }] },
        };
        playerBar.currentSeconds = 178;
        playerBar.seekableEndSeconds = 385;
        progressBar.current = 0;
        progressBar.duration = 205;
        intervalCallback();
        assert.equal(messages.at(-1).state.currentTime, 0);
        assert.equal(messages.at(-1).state.duration, 205);
        assert.equal(messages.at(-1).state.videoId, 'next-track-id');

        progressBar.current = 1;
        playerBar.seekableEndSeconds = 205;
        intervalCallback();
        assert.equal(messages.at(-1).state.currentTime, 1);
      } finally {
        for (const [name, descriptor] of originalDescriptors) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor);
          else delete globalThis[name];
        }
      }
    });

    await t.test('video öğesi olmadan player bar durumunu bağlantı üzerinden raporlar', async () => {
      const globalNames = [
        '__pageCanMediaBrowserTestState',
        'defineContentScript',
        'document',
        'location',
        'navigator',
        'window',
      ];
      const originalDescriptors = new Map(globalNames.map((name) => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name),
      ]));
      const originalDateNow = Date.now;
      let now = 1_000;
      let intervalCallback = () => undefined;
      const progressBar = {
        getAttribute(name) {
          if (name === 'aria-valuenow') return '24';
          if (name === 'aria-valuemax') return '180';
          return null;
        },
      };
      const playerBar = {
        querySelector: () => null,
      };
      const browserState = {
        messageListener: null,
        connectListener: null,
        sentMessages: [],
      };

      try {
        Date.now = () => now;
        globalThis.__pageCanMediaBrowserTestState = browserState;
        globalThis.defineContentScript = (value) => value;
        globalThis.location = {
          hostname: 'music.youtube.com',
          origin: 'https://music.youtube.com',
          href: 'https://music.youtube.com/watch?v=track-id',
        };
        Object.defineProperty(globalThis, 'navigator', {
          configurable: true,
          writable: true,
          value: {
            mediaSession: {
              metadata: null,
              playbackState: 'playing',
            },
          },
        });
        globalThis.document = {
          title: 'YouTube Music',
          querySelector(selector) {
            if (selector === 'ytmusic-player-bar') return playerBar;
            if (selector === 'ytmusic-player-bar #progress-bar') return progressBar;
            if (selector.includes('.title')) return { textContent: 'Çalan parça' };
            if (selector.includes('.byline')) return { textContent: 'Sanatçı' };
            return null;
          },
          querySelectorAll: () => [],
        };
        globalThis.window = {};

        const contentScript = await server.ssrLoadModule('/entrypoints/youtube-media.content.ts');
        contentScript.default.main({
          addEventListener: () => undefined,
          onInvalidated: () => undefined,
          setInterval(callback) {
            intervalCallback = callback;
            return 1;
          },
          setTimeout: () => 1,
        });

        assert.equal(typeof browserState.messageListener, 'function');
        let response;
        const keepChannelOpen = browserState.messageListener(
          { type: media.MEDIA_STATE_REQUEST },
          {},
          (value) => { response = value; },
        );
        assert.equal(keepChannelOpen, undefined);
        assert.equal(response.title, 'Çalan parça');
        assert.equal(response.paused, false);
        assert.equal(response.currentTime, 24);
        assert.equal(response.duration, 180);

        const portMessages = [];
        let portMessageListener = null;
        const port = {
          name: media.MEDIA_PORT_NAME,
          postMessage(message) {
            portMessages.push(structuredClone(message));
          },
          disconnect: () => undefined,
          onMessage: {
            addListener(listener) { portMessageListener = listener; },
            removeListener(listener) {
              if (portMessageListener === listener) portMessageListener = null;
            },
          },
          onDisconnect: {
            addListener: () => undefined,
            removeListener: () => undefined,
          },
        };
        assert.equal(typeof browserState.connectListener, 'function');
        browserState.connectListener(port);
        assert.equal(portMessages.at(-1).state.title, 'Çalan parça');
        assert.equal(portMessages.at(-1).state.currentTime, 24);
        portMessageListener({ type: media.MEDIA_STATE_REQUEST });
        assert.equal(portMessages.at(-1).state.duration, 180);

        browserState.sentMessages = [];
        now = 3_000;
        intervalCallback();
        await Promise.resolve();
        assert.equal(browserState.sentMessages.length, 1);
        assert.equal(browserState.sentMessages[0].state.title, 'Çalan parça');
      } finally {
        Date.now = originalDateNow;
        for (const [name, descriptor] of originalDescriptors) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor);
          else delete globalThis[name];
        }
      }
    });

    await t.test('geçersiz veya eksik süreyi kabul etmez', () => {
      assert.equal(media.parseMediaDurationText('Canlı'), 0);
      assert.equal(media.parseMediaDurationText('1:72'), 0);
      assert.equal(media.parseMediaDurationText(''), 0);
    });
  } finally {
    await server.close();
  }
});

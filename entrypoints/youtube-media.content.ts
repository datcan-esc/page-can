import { browser, type Browser } from 'wxt/browser';
import {
  MEDIA_PORT_NAME,
  MEDIA_STATE_REPORT,
  YOUTUBE_PLAYER_BRIDGE_VERSION,
  YOUTUBE_PLAYER_SEEK,
  isMediaCommandMessage,
  isMediaStateRequest,
  isYouTubePlayerStateMessage,
  mediaTimelineOffset,
  parseMediaTimeText,
  shouldForcePlayerTimingReport,
  type MediaCommandResult,
  type MediaControl,
  type MediaSnapshot,
  type MediaStateReport,
  type ParsedMediaTimeText,
  type YouTubePlayerSeekMessage,
  type YouTubePlayerTiming,
} from '../lib/media';

const PLAYBACK_EVENTS = [
  'play',
  'pause',
  'ended',
  'loadedmetadata',
  'durationchange',
  'seeking',
  'seeked',
  'ratechange',
  'emptied',
] as const;

export default defineContentScript({
  matches: ['https://www.youtube.com/*', 'https://music.youtube.com/*'],
  runAt: 'document_idle',
  noScriptStartedPostMessage: true,
  main(ctx) {
    const provider = location.hostname === 'music.youtube.com' ? 'youtube-music' : 'youtube';
    let video: HTMLMediaElement | null = null;
    let videoListeners = new AbortController();
    let lastReportAt = 0;
    let durationIdentity = '';
    let confirmedDuration = 0;
    let trackTimelineOffset = 0;
    let lastPageTime: number | null = null;
    let playerTiming: YouTubePlayerTiming | null = null;
    let playerTimingReceivedAt = 0;
    let activeBridgeVersion = YOUTUBE_PLAYER_BRIDGE_VERSION;
    const ports = new Set<Browser.runtime.Port>();
    let observedPlayerRoot: Element | null = null;
    const playerObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          bindVideo();
          report();
        });

    function finiteNumber(value: string | number | null | undefined): number | null {
      const number = typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : Number.NaN;
      return Number.isFinite(number) ? number : null;
    }

    function firstText(selectors: string[]): string {
      for (const selector of selectors) {
        const text = document.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
        if (text) return text;
      }
      return '';
    }

    function normalizedUrl(value: string | undefined): string {
      if (!value) return '';
      try {
        return new URL(value, location.href).href;
      } catch {
        return '';
      }
    }

    function mediaMetadata() {
      return 'mediaSession' in navigator ? navigator.mediaSession.metadata : null;
    }

    function titleFromPage(): string {
      const metadataTitle = mediaMetadata()?.title?.trim();
      if (metadataTitle) return metadataTitle;

      const title = provider === 'youtube-music'
        ? firstText([
            'ytmusic-player-bar .title',
            'ytmusic-player-bar yt-formatted-string.title',
            'ytmusic-player-bar .content-info-wrapper .title',
          ])
        : firstText([
            'ytd-watch-metadata h1 yt-formatted-string',
            'h1.ytd-watch-metadata yt-formatted-string',
            'ytd-reel-video-renderer[is-active] h2',
          ]);
      if (title) return title;

      const documentTitle = document.title
        .replace(/\s+-\s+YouTube(?: Music)?\s*$/i, '')
        .trim();
      return documentTitle === 'YouTube' || documentTitle === 'YouTube Music' ? '' : documentTitle;
    }

    function artistFromPage(): string {
      const metadataArtist = mediaMetadata()?.artist?.trim();
      if (metadataArtist) return metadataArtist;

      return provider === 'youtube-music'
        ? firstText([
            'ytmusic-player-bar .byline',
            'ytmusic-player-bar yt-formatted-string.byline',
            'ytmusic-player-bar .subtitle',
          ])
        : firstText([
            'ytd-watch-metadata #channel-name a',
            'ytd-video-owner-renderer #channel-name a',
            '#upload-info #channel-name a',
          ]);
    }

    function artworkFromPage(): string {
      const metadataArtwork = mediaMetadata()?.artwork;
      const metadataSource = metadataArtwork?.length
        ? metadataArtwork[metadataArtwork.length - 1]?.src
        : undefined;
      if (metadataSource) return normalizedUrl(metadataSource);

      const image = provider === 'youtube-music'
        ? document.querySelector<HTMLImageElement>('ytmusic-player-bar img.image, ytmusic-player-bar img')?.src
        : document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
      return normalizedUrl(image);
    }

    function findVideo(): HTMLMediaElement | null {
      const selectors = provider === 'youtube-music'
        ? [
            'ytmusic-player #movie_player video.html5-main-video',
            'ytmusic-player #movie_player video',
            'ytmusic-player #movie_player audio',
            'ytmusic-player video.html5-main-video',
            'ytmusic-player video',
            'ytmusic-player audio',
            'video.html5-main-video',
            '#movie_player video',
            '#movie_player audio',
            'video',
            'audio',
          ]
        : [
            'ytd-player #movie_player video.html5-main-video',
            '#movie_player video.html5-main-video',
            'ytd-player #movie_player video',
            '#movie_player video',
            'ytd-reel-video-renderer[is-active] video',
            'video',
          ];

      for (const selector of selectors) {
        const candidate = document.querySelector<HTMLMediaElement>(selector);
        if (candidate) return candidate;
      }
      return null;
    }

    function controlButton(action: 'toggle' | 'previous' | 'next'): HTMLElement | null {
      const selectors = provider === 'youtube-music'
        ? action === 'toggle'
          ? [
              'ytmusic-player-bar #play-pause-button',
              'ytmusic-player-bar .play-pause-button',
            ]
          : action === 'previous'
            ? ['ytmusic-player-bar .previous-button', 'ytmusic-player-bar [icon="previous"]']
            : ['ytmusic-player-bar .next-button', 'ytmusic-player-bar [icon="next"]']
        : action === 'toggle'
          ? ['#movie_player .ytp-play-button']
          : action === 'previous'
            ? ['#movie_player .ytp-prev-button']
            : ['#movie_player .ytp-next-button'];

      for (const selector of selectors) {
        const element = document.querySelector<HTMLElement>(selector);
        if (element) return element;
      }
      return null;
    }

    function buttonEnabled(element: HTMLElement | null): boolean {
      if (!element) return false;
      const style = getComputedStyle(element);
      return (
        element.getAttribute('aria-disabled') !== 'true' &&
        !element.hasAttribute('disabled') &&
        !element.classList.contains('disabled') &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    }

    function parsedTimeFromElements(selectors: string[]): ParsedMediaTimeText | null {
      let fallback: ParsedMediaTimeText | null = null;
      for (const selector of selectors) {
        for (const element of document.querySelectorAll(selector)) {
          const parsed = parseMediaTimeText(element.textContent ?? '');
          if (!parsed) continue;
          if (element.getClientRects().length > 0) return parsed;
          fallback ??= parsed;
        }
      }
      return fallback;
    }

    function timingFromPage(): ParsedMediaTimeText | null {
      if (provider === 'youtube-music') {
        const progressBar = document.querySelector<HTMLElement>(
          'ytmusic-player-bar #progress-bar',
        );
        const currentTime = finiteNumber(progressBar?.getAttribute('aria-valuenow'));
        const duration = finiteNumber(progressBar?.getAttribute('aria-valuemax'));
        if (
          currentTime !== null &&
          currentTime >= 0 &&
          duration !== null &&
          duration > 0
        ) {
          return { currentTime: Math.min(currentTime, duration), duration };
        }

        return parsedTimeFromElements([
          'ytmusic-player-bar .time-info',
          'ytmusic-player-bar yt-formatted-string.time-info',
        ]);
      }

      const durationTiming = parsedTimeFromElements([
        '#movie_player .ytp-time-duration',
        'ytd-reel-video-renderer[is-active] .ytp-time-duration',
      ]);
      if (!durationTiming || durationTiming.duration <= 0) return null;

      const currentTiming = parsedTimeFromElements([
        '#movie_player .ytp-time-current',
        'ytd-reel-video-renderer[is-active] .ytp-time-current',
      ]);
      return {
        currentTime: currentTiming?.duration ?? null,
        duration: durationTiming.duration,
      };
    }

    function activePlayerTiming(
      currentVideo: HTMLMediaElement | null = video,
    ): YouTubePlayerTiming | null {
      if (!playerTiming || Date.now() - playerTimingReceivedAt > 1_800) return null;
      const mediaSessionPaused = 'mediaSession' in navigator
        ? navigator.mediaSession.playbackState !== 'playing'
        : true;
      const paused = playerTiming.paused ?? currentVideo?.paused ?? mediaSessionPaused;
      const playbackRate = playerTiming.playbackRate ?? (
        currentVideo && Number.isFinite(currentVideo.playbackRate)
          ? currentVideo.playbackRate
          : 1
      );
      const elapsed = paused
        ? 0
        : Math.max(0, Date.now() - playerTimingReceivedAt) / 1000 * playbackRate;
      return {
        ...playerTiming,
        currentTime: Math.min(playerTiming.duration, playerTiming.currentTime + elapsed),
      };
    }

    function resolvedTiming(
      currentVideo: HTMLMediaElement,
      title: string,
      directTiming: YouTubePlayerTiming | null,
    ) {
      if (directTiming) {
        const identity = `player:${directTiming.videoId || location.href}\n${directTiming.title || title}`;
        if (identity !== durationIdentity) {
          durationIdentity = identity;
          confirmedDuration = directTiming.duration;
          trackTimelineOffset = 0;
          lastPageTime = null;
        }
        return {
          currentTime: directTiming.currentTime,
          duration: directTiming.duration,
          timelineOffset: 0,
          source: 'player' as const,
        };
      }

      const identity = `${location.href}\n${currentVideo.currentSrc}\n${title}`;
      if (identity !== durationIdentity) {
        durationIdentity = identity;
        confirmedDuration = 0;
        trackTimelineOffset = 0;
        lastPageTime = null;
      }

      const pageTiming = timingFromPage();
      if (pageTiming && pageTiming.duration > 0) confirmedDuration = pageTiming.duration;

      const elementTime = Number.isFinite(currentVideo.currentTime) ? currentVideo.currentTime : 0;
      const mediaDuration = currentVideo.duration;
      const hasStableEnd = (
        Number.isFinite(mediaDuration) &&
        mediaDuration > 0 &&
        (currentVideo.ended || mediaDuration > elementTime + 1)
      );
      const duration = confirmedDuration || (hasStableEnd ? mediaDuration : 0);
      const pageCurrentTime = pageTiming?.currentTime ?? null;
      const detectedOffset = mediaTimelineOffset(elementTime, pageCurrentTime);
      const pageClockReset = (
        pageCurrentTime !== null &&
        lastPageTime !== null &&
        pageCurrentTime < lastPageTime - 2
      );

      if (pageClockReset) trackTimelineOffset = detectedOffset;
      else if (trackTimelineOffset === 0 && detectedOffset > 0) {
        trackTimelineOffset = detectedOffset;
      }
      if (pageCurrentTime !== null) lastPageTime = pageCurrentTime;

      const elementTrackTime = Math.max(0, elementTime - trackTimelineOffset);
      const currentTime = (
        pageCurrentTime !== null &&
        Math.abs(elementTrackTime - pageCurrentTime) > 2
      ) ? pageCurrentTime : elementTrackTime;

      return {
        currentTime: duration > 0 ? Math.min(currentTime, duration) : currentTime,
        duration,
        timelineOffset: trackTimelineOffset,
        source: 'fallback' as const,
      };
    }

    function snapshot(): MediaSnapshot | null {
      const currentVideo = video ?? findVideo();
      const directTiming = activePlayerTiming(currentVideo);
      const title = directTiming?.title || titleFromPage();
      const playerSurface = provider === 'youtube-music'
        ? document.querySelector('ytmusic-player-bar')
        : document.querySelector('#movie_player, ytd-player');
      if (!title || (!currentVideo && !directTiming && !playerSurface)) return null;

      const pageTiming = timingFromPage();
      const timing = currentVideo
        ? resolvedTiming(currentVideo, title, directTiming)
        : directTiming
          ? {
              currentTime: directTiming.currentTime,
              duration: directTiming.duration,
              timelineOffset: 0,
              source: 'player' as const,
            }
          : {
              currentTime: pageTiming?.currentTime ?? 0,
              duration: pageTiming?.duration ?? 0,
              timelineOffset: 0,
              source: 'fallback' as const,
            };
      const mediaSessionPaused = 'mediaSession' in navigator
        ? navigator.mediaSession.playbackState !== 'playing'
        : true;
      const playbackRate = directTiming?.playbackRate ?? (
        currentVideo && Number.isFinite(currentVideo.playbackRate)
          ? currentVideo.playbackRate
          : 1
      );

      return {
        provider,
        mediaId: directTiming?.videoId || `${provider}:${location.href}\n${title}`,
        title: title || (provider === 'youtube-music' ? 'YouTube Music' : 'YouTube'),
        artist: directTiming?.artist || artistFromPage(),
        artworkUrl: artworkFromPage(),
        currentTime: timing.currentTime,
        duration: timing.duration,
        playbackRate,
        paused: directTiming?.paused ?? currentVideo?.paused ?? mediaSessionPaused,
        ended: directTiming?.ended ?? currentVideo?.ended ?? false,
        canPrevious: buttonEnabled(controlButton('previous')),
        canNext: buttonEnabled(controlButton('next')),
        updatedAt: Date.now(),
      };
    }

    function report(force = false) {
      const now = Date.now();
      if (!force && now - lastReportAt < 650) return;
      lastReportAt = now;
      const message: MediaStateReport = { type: MEDIA_STATE_REPORT, state: snapshot() };
      for (const port of ports) {
        try {
          port.postMessage(message);
        } catch {
          ports.delete(port);
        }
      }
      void browser.runtime.sendMessage(message).catch(() => undefined);
    }

    function handlePlayerBridgeMessage(event: MessageEvent) {
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        !isYouTubePlayerStateMessage(event.data)
      ) return;

      const bridgeVersion = event.data.bridgeVersion ?? 0;
      if (bridgeVersion < activeBridgeVersion) return;
      if (bridgeVersion > activeBridgeVersion) activeBridgeVersion = bridgeVersion;

      const previousTiming = playerTiming;
      playerTiming = event.data.state;
      playerTimingReceivedAt = Date.now();
      report(shouldForcePlayerTimingReport(previousTiming, playerTiming));
    }

    function bindVideo() {
      const nextVideo = findVideo();
      observePlayerRoot();
      if (nextVideo === video) return;

      videoListeners.abort();
      videoListeners = new AbortController();
      video = nextVideo;

      if (video) {
        for (const eventName of PLAYBACK_EVENTS) {
          video.addEventListener(eventName, () => report(true), { signal: videoListeners.signal });
        }
        video.addEventListener('timeupdate', () => report(), { signal: videoListeners.signal });
      }
      report(true);
    }

    function observePlayerRoot() {
      if (!playerObserver) return;
      const nextRoot = provider === 'youtube-music'
        ? document.querySelector('ytmusic-player-bar')
        : document.querySelector('#movie_player, ytd-player');
      if (nextRoot === observedPlayerRoot) return;

      playerObserver.disconnect();
      observedPlayerRoot = nextRoot;
      if (observedPlayerRoot) {
        playerObserver.observe(observedPlayerRoot, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['aria-valuenow', 'aria-valuemax', 'aria-disabled', 'disabled'],
        });
      }
    }

    async function applyCommand(command: MediaControl): Promise<MediaCommandResult> {
      bindVideo();

      let ok = true;
      try {
        if (command.action === 'toggle') {
          if (video) {
            if (video.paused || video.ended) await video.play();
            else video.pause();
          } else {
            const button = controlButton('toggle');
            if (!buttonEnabled(button)) ok = false;
            else button?.click();
          }
        } else if (command.action === 'seek-to') {
          if (!Number.isFinite(command.time)) ok = false;
          else {
            const directTiming = activePlayerTiming(video);
            const pageTiming = timingFromPage();
            const timing = video
              ? resolvedTiming(video, titleFromPage(), directTiming)
              : {
                  currentTime: directTiming?.currentTime ?? pageTiming?.currentTime ?? 0,
                  duration: directTiming?.duration ?? pageTiming?.duration ?? 0,
                  timelineOffset: 0,
                  source: directTiming ? 'player' as const : 'fallback' as const,
                };
            const trackTime = Math.max(
              0,
              Math.min(command.time, timing.duration || command.time),
            );
            if (timing.source === 'player' || provider === 'youtube-music') {
              const message: YouTubePlayerSeekMessage = {
                type: YOUTUBE_PLAYER_SEEK,
                time: trackTime,
              };
              window.postMessage(message, location.origin);
            } else if (video) {
              video.currentTime = timing.timelineOffset + trackTime;
            } else {
              ok = false;
            }
          }
        } else {
          const button = controlButton(command.action);
          if (!buttonEnabled(button)) ok = false;
          else button?.click();
        }
      } catch {
        ok = false;
      }

      report(true);
      if (command.action === 'next' || command.action === 'previous') {
        ctx.setTimeout(() => {
          bindVideo();
          report(true);
        }, 700);
      }
      return { ok, state: snapshot() };
    }

    function postCurrentState(port: Browser.runtime.Port) {
      const message: MediaStateReport = { type: MEDIA_STATE_REPORT, state: snapshot() };
      try {
        port.postMessage(message);
      } catch {
        ports.delete(port);
      }
    }

    function handleConnect(port: Browser.runtime.Port) {
      if (port.name !== MEDIA_PORT_NAME) return;
      ports.add(port);

      const handlePortMessage = (message: unknown) => {
        if (isMediaStateRequest(message)) {
          bindVideo();
          postCurrentState(port);
          return;
        }
        if (isMediaCommandMessage(message)) {
          void applyCommand(message.command).then(
            () => postCurrentState(port),
            () => postCurrentState(port),
          );
        }
      };
      const handleDisconnect = () => {
        ports.delete(port);
        port.onMessage.removeListener(handlePortMessage);
        port.onDisconnect.removeListener(handleDisconnect);
      };

      port.onMessage.addListener(handlePortMessage);
      port.onDisconnect.addListener(handleDisconnect);
      bindVideo();
      postCurrentState(port);
    }

    const handleMessage = (
      message: unknown,
      _sender: unknown,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (isMediaStateRequest(message)) {
        bindVideo();
        sendResponse(snapshot());
        return undefined;
      }
      if (isMediaCommandMessage(message)) {
        void applyCommand(message.command).then(
          sendResponse,
          () => sendResponse({ ok: false, state: snapshot() } satisfies MediaCommandResult),
        );
        return true;
      }
      return undefined;
    };

    browser.runtime.onMessage.addListener(handleMessage);
    browser.runtime.onConnect.addListener(handleConnect);
    ctx.addEventListener(window, 'message', handlePlayerBridgeMessage);
    ctx.onInvalidated(() => {
      videoListeners.abort();
      playerObserver?.disconnect();
      browser.runtime.onMessage.removeListener(handleMessage);
      browser.runtime.onConnect.removeListener(handleConnect);
      for (const port of ports) port.disconnect();
      ports.clear();
    });
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      ctx.setTimeout(() => {
        bindVideo();
        report(true);
      }, 250);
    });
    ctx.addEventListener(window, 'pagehide', () => {
      const message: MediaStateReport = { type: MEDIA_STATE_REPORT, state: null };
      void browser.runtime.sendMessage(message).catch(() => undefined);
    });
    ctx.setInterval(() => {
      bindVideo();
      report();
    }, 1_500);
    bindVideo();
  },
});

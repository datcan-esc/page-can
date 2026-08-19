import {
  YOUTUBE_PLAYER_SEEK,
  YOUTUBE_PLAYER_STATE,
  YOUTUBE_PLAYER_BRIDGE_VERSION,
  isYouTubePlayerSeekMessage,
  parseMediaDurationText,
  resolveMediaTrackClock,
  type MediaTrackClock,
  type YouTubePlayerStateMessage,
  type YouTubePlayerTiming,
} from '../lib/media';

interface YouTubeVideoData {
  video_id?: string;
  title?: string;
  author?: string;
  isLive?: boolean;
  isLivePlayback?: boolean;
  length_seconds?: number | string;
}

interface YouTubeText {
  simpleText?: string;
  runs?: Array<{ text?: string }>;
}

interface YouTubeMusicQueueItem {
  videoId?: string;
  title?: YouTubeText | string;
  shortBylineText?: YouTubeText | string;
  longBylineText?: YouTubeText | string;
  lengthText?: YouTubeText | string;
  navigationEndpoint?: {
    watchEndpoint?: { videoId?: string };
  };
}

interface YouTubePlayerResponse {
  videoDetails?: {
    videoId?: string;
    lengthSeconds?: number | string;
  };
}

interface YouTubeProgressState {
  current?: number;
  duration?: number;
  seekableStart?: number;
  seekableEnd?: number;
}

interface YouTubePlayerApi {
  getCurrentTime?: () => number;
  getCurrentTimeForUx?: () => number;
  getDuration?: () => number;
  getDurationForUx?: () => number;
  getPlaybackRate?: () => number;
  getPlayerState?: () => number;
  getProgressState?: () => YouTubeProgressState;
  getPlayerResponse?: () => YouTubePlayerResponse;
  getVideoData?: () => YouTubeVideoData;
  getVideoUrl?: () => string;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
}

type SeekableYouTubePlayerApi = YouTubePlayerApi & {
  seekTo: NonNullable<YouTubePlayerApi['seekTo']>;
};

interface YouTubePlayerElement extends HTMLElement, YouTubePlayerApi {}

interface YouTubeMusicProgressElement extends HTMLElement {
  value?: number | string;
  max?: number | string;
}

interface YouTubeMusicPlayerBar extends HTMLElement {
  currentSeconds?: number;
  seekableEndSeconds?: number;
  isLive?: boolean;
  currentItem?: YouTubeMusicQueueItem;
  playerApi?: YouTubePlayerApi;
}

interface BridgeWindow extends Window {
  __pageCanYouTubePlayerBridge?: boolean | {
    bridgeVersion: number;
    dispose: () => void;
  };
}

export default defineContentScript({
  matches: ['https://www.youtube.com/*', 'https://music.youtube.com/*'],
  runAt: 'document_idle',
  world: 'MAIN',
  noScriptStartedPostMessage: true,
  main() {
    const bridgeWindow = window as BridgeWindow;
    const previousBridge = bridgeWindow.__pageCanYouTubePlayerBridge;
    if (typeof previousBridge === 'object') previousBridge.dispose();

    let lastFingerprint = '';
    let musicClock: MediaTrackClock | null = null;
    let allowMusicBackwardUntil = 0;
    let publishInterval = 0;
    let disposed = false;

    const isYouTubeMusic = location.hostname === 'music.youtube.com';

    function finiteNumber(...values: unknown[]): number | null {
      for (const value of values) {
        const number = typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim()
            ? Number(value)
            : Number.NaN;
        if (Number.isFinite(number)) return number;
      }
      return null;
    }

    function firstText(root: ParentNode, selectors: string[]): string {
      for (const selector of selectors) {
        const text = root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
        if (text) return text;
      }
      return '';
    }

    function rendererText(value: YouTubeText | string | undefined): string {
      if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
      const text = value?.simpleText ?? value?.runs?.map((run) => run.text ?? '').join('');
      return text?.replace(/\s+/g, ' ').trim() ?? '';
    }

    function findPlayer(): YouTubePlayerElement | null {
      const selectors = isYouTubeMusic
        ? ['ytmusic-player #movie_player', '#movie_player']
        : [
            'ytd-reel-video-renderer[is-active] #movie_player',
            'ytd-player #movie_player',
            '#movie_player',
          ];

      for (const selector of selectors) {
        const player = document.querySelector<YouTubePlayerElement>(selector);
        if (
          player && (
            typeof player.getCurrentTime === 'function' ||
            typeof player.getPlayerState === 'function' ||
            typeof player.getVideoData === 'function'
          )
        ) return player;
      }
      return null;
    }

    function playbackDetails(player: YouTubePlayerApi | null) {
      const media = document.querySelector<HTMLMediaElement>('video, audio');
      let playerState: number | null = null;
      let playerRate: number | null = null;
      try {
        playerState = finiteNumber(player?.getPlayerState?.());
        playerRate = finiteNumber(player?.getPlaybackRate?.());
      } catch {
        // The standard media element and Media Session remain usable fallbacks.
      }

      const mediaSessionState = 'mediaSession' in navigator
        ? navigator.mediaSession.playbackState
        : 'none';
      const paused = playerState !== null
        ? playerState !== 1 && playerState !== 3
        : media?.paused ?? mediaSessionState !== 'playing';
      return {
        paused,
        ended: playerState === 0 || media?.ended === true,
        playbackRate: playerRate ?? (
          media && Number.isFinite(media.playbackRate) ? media.playbackRate : 1
        ),
      };
    }

    function videoIdFromUrl(player: YouTubePlayerApi): string {
      try {
        return new URL(player.getVideoUrl?.() ?? location.href, location.href)
          .searchParams.get('v') ?? '';
      } catch {
        return '';
      }
    }

    function playerIdentity(player: YouTubePlayerApi | null) {
      try {
        const videoData = player?.getVideoData?.() ?? {};
        return {
          videoId: videoData.video_id?.trim() || (player ? videoIdFromUrl(player) : ''),
          title: videoData.title?.trim() ?? '',
          artist: videoData.author?.trim() ?? '',
          isLive: videoData.isLive === true || videoData.isLivePlayback === true,
        };
      } catch {
        return { videoId: '', title: '', artist: '', isLive: false };
      }
    }

    function musicPlayerBar(): YouTubeMusicPlayerBar | null {
      return document.querySelector<YouTubeMusicPlayerBar>('ytmusic-player-bar');
    }

    function readYouTubeMusicTiming(): YouTubePlayerTiming | null {
      const playerBar = musicPlayerBar();
      if (!playerBar || playerBar.isLive === true) return null;

      const player = playerBar.playerApi ?? findPlayer();
      const progressBar = playerBar.querySelector<YouTubeMusicProgressElement>('#progress-bar');
      let progressState: YouTubeProgressState = {};
      let playerResponse: YouTubePlayerResponse = {};
      try {
        progressState = player?.getProgressState?.() ?? {};
        playerResponse = player?.getPlayerResponse?.() ?? {};
      } catch {
        // The player bar's own bound values remain available below.
      }

      const sliderTime = finiteNumber(progressBar?.getAttribute('aria-valuenow'));
      const sliderDuration = finiteNumber(progressBar?.getAttribute('aria-valuemax'));
      const rawTime = finiteNumber(
        sliderTime,
        playerBar.currentSeconds,
        progressState.current,
        progressBar?.value,
      );
      const timelineEnd = finiteNumber(
        sliderDuration,
        playerBar.seekableEndSeconds,
        progressState.seekableEnd,
        progressBar?.max,
      );
      const identity = playerIdentity(player);
      const currentItem = playerBar.currentItem;
      const itemVideoId = currentItem?.videoId?.trim()
        || currentItem?.navigationEndpoint?.watchEndpoint?.videoId?.trim()
        || '';
      const videoId = itemVideoId || identity.videoId;
      const itemTitle = rendererText(currentItem?.title);
      const itemArtist = rendererText(
        currentItem?.shortBylineText ?? currentItem?.longBylineText,
      );
      const domTitle = firstText(playerBar, [
        '.title',
        'yt-formatted-string.title',
        '.content-info-wrapper .title',
      ]);
      const domArtist = firstText(playerBar, [
        '.byline',
        'yt-formatted-string.byline',
        '.subtitle',
      ]);
      const title = itemTitle || domTitle || identity.title;
      const artist = itemArtist || domArtist || identity.artist;

      const itemDuration = parseMediaDurationText(rendererText(currentItem?.lengthText));
      const responseDetails = playerResponse.videoDetails;
      const responseMatches = !videoId
        || !responseDetails?.videoId
        || responseDetails.videoId === videoId;
      const responseDuration = responseMatches
        ? finiteNumber(responseDetails?.lengthSeconds)
        : null;
      const stableDuration = finiteNumber(
        itemDuration > 0 ? itemDuration : null,
        responseDuration !== null && responseDuration > 0 ? responseDuration : null,
      );
      const duration = stableDuration ?? timelineEnd;
      if (rawTime === null || rawTime < 0 || duration === null || duration <= 0) return null;

      // In gapless playback seekableEnd can contain the previous track's timeline.
      // A queue duration makes that offset observable without treating it as total time.
      const sliderIsTrackClock = (
        sliderTime !== null &&
        sliderDuration !== null &&
        sliderDuration > 0 &&
        sliderTime <= sliderDuration + 1
      );
      const observedOffset = sliderIsTrackClock
        ? 0
        : (
            stableDuration !== null &&
            timelineEnd !== null &&
            timelineEnd >= stableDuration - 1
          ) ? Math.max(0, timelineEnd - stableDuration) : null;
      const trackKey = videoId || `${title}\n${artist}`;
      musicClock = resolveMediaTrackClock(
        musicClock,
        trackKey,
        rawTime,
        observedOffset,
        Date.now() < allowMusicBackwardUntil,
      );

      return {
        videoId,
        title,
        artist,
        currentTime: Math.min(musicClock.currentTime, duration),
        duration,
        ...playbackDetails(player),
        updatedAt: Date.now(),
      };
    }

    function readYouTubeTiming(): YouTubePlayerTiming | null {
      const player = findPlayer();
      if (!player) return null;

      try {
        const identity = playerIdentity(player);
        if (identity.isLive) return null;

        const progressState = player.getProgressState?.() ?? {};
        const progressBar = document.querySelector<HTMLElement>(
          'ytd-reel-video-renderer[is-active] .ytp-progress-bar, ytd-player .ytp-progress-bar, #movie_player .ytp-progress-bar',
        );
        const currentTime = finiteNumber(
          player.getCurrentTime?.(),
          player.getCurrentTimeForUx?.(),
          progressState.current,
          progressBar?.getAttribute('aria-valuenow'),
        );
        const duration = finiteNumber(
          player.getDuration?.(),
          player.getDurationForUx?.(),
          progressState.duration,
          progressState.seekableEnd,
          progressBar?.getAttribute('aria-valuemax'),
        );
        if (
          currentTime === null ||
          currentTime < 0 ||
          duration === null ||
          duration <= 0
        ) return null;

        return {
          videoId: identity.videoId,
          title: identity.title,
          artist: identity.artist,
          currentTime: Math.min(currentTime, duration),
          duration,
          ...playbackDetails(player),
          updatedAt: Date.now(),
        };
      } catch {
        return null;
      }
    }

    function readTiming(): YouTubePlayerTiming | null {
      return isYouTubeMusic ? readYouTubeMusicTiming() : readYouTubeTiming();
    }

    function activeSeekPlayerApi(): SeekableYouTubePlayerApi | null {
      // The player-bar API is useful for reading timing, but some YouTube Music
      // builds expose it without seekTo. Prefer the real movie player for
      // controls and only use the player-bar API when it is actually seekable.
      const candidates = [
        findPlayer(),
        isYouTubeMusic ? musicPlayerBar()?.playerApi : null,
      ];
      return candidates.find(
        (candidate): candidate is SeekableYouTubePlayerApi => (
          typeof candidate?.seekTo === 'function'
        ),
      ) ?? null;
    }

    function publishTiming(force = false) {
      if (disposed) return;
      const state = readTiming();
      const fingerprint = state
        ? `${state.videoId}\n${state.title}\n${Math.floor(state.currentTime * 4)}\n${Math.round(state.duration * 10)}\n${state.paused}\n${state.ended}`
        : 'unavailable';
      if (!force && fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;

      const message: YouTubePlayerStateMessage = {
        type: YOUTUBE_PLAYER_STATE,
        bridgeVersion: YOUTUBE_PLAYER_BRIDGE_VERSION,
        state,
      };
      window.postMessage(message, location.origin);
    }

    function handleBridgeMessage(event: MessageEvent) {
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        !isYouTubePlayerSeekMessage(event.data)
      ) return;

      const player = activeSeekPlayerApi();
      if (!player) return;
      try {
        if (isYouTubeMusic) allowMusicBackwardUntil = Date.now() + 1_500;
        // seekTo uses time within the current video. The second argument must
        // be true after the slider is released so an unbuffered forward seek
        // is allowed to request the target media segment.
        player.seekTo(event.data.time, true);
        window.setTimeout(() => publishTiming(true), 120);
      } catch {
        // The isolated-world content script will retain its HTMLMediaElement fallback.
      }
    }

    const bridgeRuntime = {
      bridgeVersion: YOUTUBE_PLAYER_BRIDGE_VERSION,
      dispose() {
        if (disposed) return;
        disposed = true;
        window.removeEventListener('message', handleBridgeMessage);
        if (publishInterval) window.clearInterval(publishInterval);
        if (bridgeWindow.__pageCanYouTubePlayerBridge === bridgeRuntime) {
          delete bridgeWindow.__pageCanYouTubePlayerBridge;
        }
      },
    };
    bridgeWindow.__pageCanYouTubePlayerBridge = bridgeRuntime;

    window.addEventListener('message', handleBridgeMessage);
    publishInterval = window.setInterval(publishTiming, 400);
    publishTiming(true);
  },
});

export const MEDIA_STATE_REQUEST = 'page-can:media-state-request';
export const MEDIA_STATE_REPORT = 'page-can:media-state-report';
export const MEDIA_COMMAND = 'page-can:media-command';
export const MEDIA_PORT_NAME = 'page-can:media-port';
export const YOUTUBE_PLAYER_STATE = 'page-can:youtube-player-state-v2';
export const YOUTUBE_PLAYER_SEEK = 'page-can:youtube-player-seek-v2';
export const YOUTUBE_PLAYER_BRIDGE_VERSION = 2;

export type MediaProvider = 'youtube' | 'youtube-music';

export interface MediaSnapshot {
  provider: MediaProvider;
  mediaId: string;
  title: string;
  artist: string;
  artworkUrl: string;
  currentTime: number;
  duration: number;
  playbackRate: number;
  paused: boolean;
  ended: boolean;
  canPrevious: boolean;
  canNext: boolean;
  updatedAt: number;
}

export type MediaControl =
  | { action: 'toggle' }
  | { action: 'previous' }
  | { action: 'next' }
  | { action: 'seek-to'; time: number };

export interface MediaStateRequest {
  type: typeof MEDIA_STATE_REQUEST;
}

export interface MediaStateReport {
  type: typeof MEDIA_STATE_REPORT;
  state: MediaSnapshot | null;
}

export interface MediaCommandMessage {
  type: typeof MEDIA_COMMAND;
  command: MediaControl;
}

export interface MediaCommandResult {
  ok: boolean;
  state: MediaSnapshot | null;
}

export interface YouTubePlayerTiming {
  videoId: string;
  title: string;
  artist: string;
  currentTime: number;
  duration: number;
  paused?: boolean;
  ended?: boolean;
  playbackRate?: number;
  updatedAt: number;
}

export interface YouTubePlayerStateMessage {
  type: typeof YOUTUBE_PLAYER_STATE;
  bridgeVersion?: number;
  state: YouTubePlayerTiming | null;
}

export interface YouTubePlayerSeekMessage {
  type: typeof YOUTUBE_PLAYER_SEEK;
  time: number;
}

export interface MediaTrackClock {
  trackKey: string;
  rawTime: number;
  offset: number;
  currentTime: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isMediaSnapshot(value: unknown): value is MediaSnapshot {
  if (!isRecord(value)) return false;
  return (
    (value.provider === 'youtube' || value.provider === 'youtube-music') &&
    typeof value.mediaId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.artist === 'string' &&
    typeof value.artworkUrl === 'string' &&
    typeof value.currentTime === 'number' &&
    typeof value.duration === 'number' &&
    typeof value.playbackRate === 'number' &&
    typeof value.paused === 'boolean' &&
    typeof value.ended === 'boolean' &&
    typeof value.canPrevious === 'boolean' &&
    typeof value.canNext === 'boolean' &&
    typeof value.updatedAt === 'number'
  );
}

export function resolveMediaTrackClock(
  previous: MediaTrackClock | null,
  trackKey: string,
  rawTime: number,
  observedOffset: number | null = null,
  allowBackward = false,
): MediaTrackClock {
  const safeRawTime = Number.isFinite(rawTime) ? Math.max(0, rawTime) : 0;
  let safeObservedOffset = (
    observedOffset !== null &&
    Number.isFinite(observedOffset) &&
    observedOffset >= 0 &&
    observedOffset <= safeRawTime + 2
  ) ? observedOffset : null;
  if (!previous) {
    const offset = safeObservedOffset ?? 0;
    return {
      trackKey,
      rawTime: safeRawTime,
      offset,
      currentTime: Math.max(0, safeRawTime - offset),
    };
  }

  const identityChanged = Boolean(
    trackKey && previous.trackKey && trackKey !== previous.trackKey,
  );
  if (identityChanged) {
    if (
      safeObservedOffset !== null &&
      Math.abs(safeRawTime - safeObservedOffset) > 15
    ) safeObservedOffset = null;

    const continuedGaplessClock = safeObservedOffset !== null || (
      safeRawTime > 2 &&
      Math.abs(safeRawTime - previous.rawTime) <= 15
    );
    const offset = safeObservedOffset ?? (continuedGaplessClock ? safeRawTime : 0);
    return {
      trackKey,
      rawTime: safeRawTime,
      offset,
      currentTime: Math.max(0, safeRawTime - offset),
    };
  }

  const nextTrackKey = trackKey || previous.trackKey;
  const sourceReset = !allowBackward && safeRawTime < previous.rawTime - 3;
  const observedMatchesClock = (
    safeObservedOffset !== null &&
    Math.abs(safeObservedOffset - previous.offset) <= 3
  );
  const observedRevealsNewTimeline = (
    safeObservedOffset !== null &&
    safeRawTime - previous.rawTime > 15 &&
    Math.abs(safeRawTime - safeObservedOffset) <= 15
  );
  const offset = sourceReset
    ? 0
    : observedMatchesClock || observedRevealsNewTimeline
      ? safeObservedOffset!
      : previous.offset;
  let currentTime = Math.max(0, safeRawTime - offset);

  const minorRegression = (
    !allowBackward &&
    currentTime < previous.currentTime &&
    previous.currentTime - currentTime <= 3
  );
  if (minorRegression) currentTime = previous.currentTime;

  return { trackKey: nextTrackKey, rawTime: safeRawTime, offset, currentTime };
}

export function stabilizeMediaCurrentTime(
  previousTime: number,
  nextTime: number,
  sameMedia: boolean,
): number {
  const regression = previousTime - nextTime;
  return sameMedia && regression > 0 && regression <= 1.25 ? previousTime : nextTime;
}

export function isMediaStateRequest(value: unknown): value is MediaStateRequest {
  return isRecord(value) && value.type === MEDIA_STATE_REQUEST;
}

export function isMediaStateReport(value: unknown): value is MediaStateReport {
  return (
    isRecord(value) &&
    value.type === MEDIA_STATE_REPORT &&
    (value.state === null || isMediaSnapshot(value.state))
  );
}

export function isMediaCommandMessage(value: unknown): value is MediaCommandMessage {
  if (!isRecord(value) || value.type !== MEDIA_COMMAND || !isRecord(value.command)) return false;
  const { action } = value.command;
  if (action === 'toggle' || action === 'previous' || action === 'next') return true;
  return action === 'seek-to' && typeof value.command.time === 'number';
}

export function isYouTubePlayerTiming(value: unknown): value is YouTubePlayerTiming {
  return (
    isRecord(value) &&
    typeof value.videoId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.artist === 'string' &&
    typeof value.currentTime === 'number' &&
    Number.isFinite(value.currentTime) &&
    value.currentTime >= 0 &&
    typeof value.duration === 'number' &&
    Number.isFinite(value.duration) &&
    value.duration >= 0 &&
    (value.paused === undefined || typeof value.paused === 'boolean') &&
    (value.ended === undefined || typeof value.ended === 'boolean') &&
    (
      value.playbackRate === undefined ||
      (typeof value.playbackRate === 'number' && Number.isFinite(value.playbackRate))
    ) &&
    typeof value.updatedAt === 'number'
  );
}

export function isYouTubePlayerStateMessage(value: unknown): value is YouTubePlayerStateMessage {
  return (
    isRecord(value) &&
    value.type === YOUTUBE_PLAYER_STATE &&
    (
      value.bridgeVersion === undefined ||
      (
        typeof value.bridgeVersion === 'number' &&
        Number.isInteger(value.bridgeVersion) &&
        value.bridgeVersion >= 0
      )
    ) &&
    (value.state === null || isYouTubePlayerTiming(value.state))
  );
}

export function isYouTubePlayerSeekMessage(value: unknown): value is YouTubePlayerSeekMessage {
  return (
    isRecord(value) &&
    value.type === YOUTUBE_PLAYER_SEEK &&
    typeof value.time === 'number' &&
    Number.isFinite(value.time) &&
    value.time >= 0
  );
}

export function shouldForcePlayerTimingReport(
  previous: YouTubePlayerTiming | null,
  next: YouTubePlayerTiming | null,
): boolean {
  if (previous === null || next === null) return previous !== next;
  return (
    previous.videoId !== next.videoId ||
    previous.title !== next.title ||
    previous.paused !== next.paused ||
    previous.ended !== next.ended ||
    next.currentTime < previous.currentTime - 2
  );
}

export function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export interface ParsedMediaTimeText {
  currentTime: number | null;
  duration: number;
}

function parseMediaTimestamp(timestamp: string): number | null {
  const parts = timestamp.split(':').map(Number);
  if (
    parts.some((part) => !Number.isInteger(part) || part < 0) ||
    parts.length < 2 ||
    parts.length > 3 ||
    parts.at(-1)! >= 60 ||
    (parts.length === 3 && (parts[1] ?? 60) >= 60)
  ) return null;

  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function parseMediaTimeText(value: string): ParsedMediaTimeText | null {
  const matches = value.match(/(?:\d+:){1,2}\d{1,2}/g);
  const durationText = matches?.at(-1);
  if (!durationText) return null;

  const duration = parseMediaTimestamp(durationText);
  if (duration === null) return null;

  const currentText = matches && matches.length > 1 ? matches.at(-2) : undefined;
  const parsedCurrentTime = currentText ? parseMediaTimestamp(currentText) : null;
  const currentTime = parsedCurrentTime !== null && parsedCurrentTime <= duration
    ? parsedCurrentTime
    : null;

  return { currentTime, duration };
}

export function parseMediaDurationText(value: string): number {
  return parseMediaTimeText(value)?.duration ?? 0;
}

export function mediaTimelineOffset(elementTime: number, trackTime: number | null): number {
  if (!Number.isFinite(elementTime) || trackTime === null || !Number.isFinite(trackTime)) return 0;
  const offset = elementTime - trackTime;
  return offset > 2 ? offset : 0;
}

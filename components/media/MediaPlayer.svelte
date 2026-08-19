<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browser, type Browser } from 'wxt/browser';
  import {
    MEDIA_COMMAND,
    MEDIA_PORT_NAME,
    MEDIA_STATE_REQUEST,
    formatMediaTime,
    isMediaSnapshot,
    isMediaStateReport,
    stabilizeMediaCurrentTime,
    type MediaCommandResult,
    type MediaControl,
    type MediaSnapshot,
  } from '../../lib/media';
  import { eventShortcut } from '../../lib/utils';
  import Card from '../ui/Card.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import './media.css';

  export let shortcut = '';
  export let onOpenSettings: () => void;

  const MEDIA_TAB_PATTERNS = [
    'https://www.youtube.com/*',
    'https://music.youtube.com/*',
  ];
  const MEDIA_CONTENT_SCRIPT = '/content-scripts/youtube-media.js';
  const MEDIA_MAIN_WORLD_SCRIPT = '/content-scripts/youtube-player-main.js';
  const MEDIA_RECOVERY_COOLDOWN_MS = 12_000;

  type MediaConnectionStatus =
    | 'searching'
    | 'no-tab'
    | 'connecting'
    | 'connected'
    | 'no-media'
    | 'blocked';

  const CONNECTION_COPY: Record<MediaConnectionStatus, { title: string; description: string }> = {
    searching: {
      title: 'Medya aranıyor',
      description: 'Açık YouTube ve YouTube Music sekmeleri kontrol ediliyor.',
    },
    'no-tab': {
      title: 'Medya bekleniyor',
      description: 'YouTube veya YouTube Music’te oynattığınız medya burada görünür.',
    },
    connecting: {
      title: 'Medya bağlanıyor',
      description: 'Oynatıcı bağlantısı kuruluyor ve gerekirse otomatik onarılıyor.',
    },
    connected: {
      title: 'Oynatma bilgisi bekleniyor',
      description: 'Bağlantı kuruldu; oynatıcıdan parça bilgisi bekleniyor.',
    },
    'no-media': {
      title: 'Oynatma bilgisi bekleniyor',
      description: 'Sekme bulundu ancak YouTube oynatıcı henüz bir parça bildirmedi.',
    },
    blocked: {
      title: 'YouTube erişimi gerekli',
      description: 'Uzantı ayrıntılarından YouTube Music için site erişimini etkinleştirin.',
    },
  };

  interface MediaSession {
    tabId: number;
    windowId: number;
    lastAccessed: number;
    receivedAt: number;
    state: MediaSnapshot;
  }

  let sessions: MediaSession[] = [];
  let activeSession: MediaSession | null = null;
  let now = Date.now();
  let clockInterval: number | undefined;
  let discoveryInterval: number | undefined;
  let reconnectTimeout: number | undefined;
  let controlTimeout: number | undefined;
  let seekPreview: number | null = null;
  let artworkError = '';
  let controlPending = false;
  let pendingTabId: number | null = null;
  let destroyed = false;
  let connectionStatus: MediaConnectionStatus = 'searching';
  const mediaPorts = new Map<number, Browser.runtime.Port>();
  const portLastMessageAt = new Map<number, number>();
  const recoveringTabs = new Set<number>();
  const lastRecoveryAt = new Map<number, number>();

  function sessionRank(session: MediaSession): [number, number, number] {
    const playing = !session.state.paused && !session.state.ended ? 1 : 0;
    return [playing, session.lastAccessed, session.state.updatedAt];
  }

  function compareSessions(left: MediaSession, right: MediaSession): number {
    const leftRank = sessionRank(left);
    const rightRank = sessionRank(right);
    return (
      rightRank[0] - leftRank[0] ||
      rightRank[1] - leftRank[1] ||
      rightRank[2] - leftRank[2]
    );
  }

  function upsertSession(
    tabId: number,
    windowId: number,
    state: MediaSnapshot,
    lastAccessed = Date.now(),
  ) {
    const previous = sessions.find((session) => session.tabId === tabId);
    const receivedAt = Date.now();
    let nextState = state;
    if (previous) {
      const previousTime = sessionCurrentTimeAt(previous, receivedAt);
      const stabilizedTime = Math.min(
        state.duration || Number.POSITIVE_INFINITY,
        stabilizeMediaCurrentTime(
          previousTime,
          state.currentTime,
          previous.state.mediaId === state.mediaId,
        ),
      );
      if (stabilizedTime !== state.currentTime) {
        nextState = { ...state, currentTime: stabilizedTime };
      }
      if (previous.state.mediaId !== state.mediaId) seekPreview = null;
    }
    const next: MediaSession = {
      tabId,
      windowId,
      state: nextState,
      lastAccessed: Math.max(previous?.lastAccessed ?? 0, lastAccessed),
      receivedAt,
    };
    sessions = [...sessions.filter((session) => session.tabId !== tabId), next];
    if (pendingTabId === tabId) finishControl(tabId);
  }

  function removeSession(tabId: number) {
    sessions = sessions.filter((session) => session.tabId !== tabId);
    if (pendingTabId === tabId) finishControl(tabId);
  }

  function finishControl(tabId: number) {
    if (pendingTabId !== tabId) return;
    if (controlTimeout) window.clearTimeout(controlTimeout);
    controlTimeout = undefined;
    pendingTabId = null;
    controlPending = false;
  }

  function beginControl(tabId: number) {
    if (controlTimeout) window.clearTimeout(controlTimeout);
    pendingTabId = tabId;
    controlPending = true;
    controlTimeout = window.setTimeout(() => finishControl(tabId), 1_800);
  }

  function tabLastAccessed(tab: { lastAccessed?: number }): number {
    return typeof tab.lastAccessed === 'number' ? tab.lastAccessed : 0;
  }

  function scheduleDiscovery(delay = 500) {
    if (destroyed || reconnectTimeout) return;
    reconnectTimeout = window.setTimeout(() => {
      reconnectTimeout = undefined;
      void discoverSessions();
    }, delay);
  }

  function disconnectMediaPort(tabId: number) {
    const port = mediaPorts.get(tabId);
    if (!port) return;
    mediaPorts.delete(tabId);
    portLastMessageAt.delete(tabId);
    try {
      port.disconnect();
    } catch {
      // It may already have been disconnected by a navigation.
    }
  }

  async function recoverMediaScripts(tab: Browser.tabs.Tab): Promise<boolean> {
    if (typeof tab.id !== 'number' || tab.status === 'loading' || destroyed) return false;
    const tabId = tab.id;
    const now = Date.now();
    if (
      recoveringTabs.has(tabId) ||
      now - (lastRecoveryAt.get(tabId) ?? 0) < MEDIA_RECOVERY_COOLDOWN_MS
    ) return false;

    recoveringTabs.add(tabId);
    lastRecoveryAt.set(tabId, now);
    connectionStatus = 'connecting';
    try {
      await browser.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        files: [MEDIA_CONTENT_SCRIPT],
        world: 'ISOLATED',
      });
      await browser.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        files: [MEDIA_MAIN_WORLD_SCRIPT],
        world: 'MAIN',
      });
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn('[page-can media] İçerik bağlantısı onarılamadı.', detail);
      connectionStatus = /permission|cannot access|host permission/i.test(detail)
        ? 'blocked'
        : 'connecting';
      return false;
    } finally {
      recoveringTabs.delete(tabId);
    }
  }

  function attachMediaPort(tab: Browser.tabs.Tab) {
    if (typeof tab.id !== 'number' || mediaPorts.has(tab.id)) return;
    const tabId = tab.id;
    let port: Browser.runtime.Port;
    try {
      port = browser.tabs.connect(tabId, { name: MEDIA_PORT_NAME, frameId: 0 });
    } catch {
      scheduleDiscovery();
      return;
    }
    mediaPorts.set(tabId, port);
    if (sessions.length === 0) connectionStatus = 'connecting';
    let receivedMessage = false;

    const handlePortMessage = (message: unknown) => {
      if (!isMediaStateReport(message)) return;
      receivedMessage = true;
      portLastMessageAt.set(tabId, Date.now());
      if (message.state) {
        connectionStatus = 'connected';
        upsertSession(tabId, tab.windowId, message.state, tabLastAccessed(tab));
      } else {
        removeSession(tabId);
        connectionStatus = sessions.length > 0 ? 'connected' : 'no-media';
      }
    };
    const handleDisconnect = () => {
      const recentlyResponded = Date.now() - (portLastMessageAt.get(tabId) ?? 0) < 3_000;
      port.onMessage.removeListener(handlePortMessage);
      port.onDisconnect.removeListener(handleDisconnect);
      if (mediaPorts.get(tabId) !== port) return;
      mediaPorts.delete(tabId);
      portLastMessageAt.delete(tabId);
      removeSession(tabId);
      if (!receivedMessage && !recentlyResponded) {
        void recoverMediaScripts(tab).then((recovered) => {
          scheduleDiscovery(recovered ? 150 : 2_000);
        });
      } else {
        connectionStatus = 'connecting';
        scheduleDiscovery();
      }
    };

    port.onMessage.addListener(handlePortMessage);
    port.onDisconnect.addListener(handleDisconnect);
    try {
      port.postMessage({ type: MEDIA_STATE_REQUEST });
    } catch {
      handleDisconnect();
    }
  }

  async function discoverSessions() {
    let tabs: Browser.tabs.Tab[];
    try {
      tabs = await browser.tabs.query({ url: MEDIA_TAB_PATTERNS });
    } catch {
      connectionStatus = 'blocked';
      scheduleDiscovery(1_500);
      return;
    }

    if (tabs.length === 0) {
      connectionStatus = 'no-tab';
    } else if (sessions.length === 0 && connectionStatus !== 'blocked') {
      connectionStatus = 'connecting';
    }

    const openTabIds = new Set<number>();
    await Promise.all(tabs.map(async (tab) => {
      if (typeof tab.id !== 'number') return;
      openTabIds.add(tab.id);
      attachMediaPort(tab);

      // One-shot messaging also covers a tab that still has an older content
      // script while the extension is being hot-reloaded in development.
      try {
        const response: unknown = await browser.tabs.sendMessage(tab.id, {
          type: MEDIA_STATE_REQUEST,
        });
        if (isMediaSnapshot(response)) {
          portLastMessageAt.set(tab.id, Date.now());
          connectionStatus = 'connected';
          upsertSession(tab.id, tab.windowId, response, tabLastAccessed(tab));
        } else if (response === null) {
          portLastMessageAt.set(tab.id, Date.now());
          removeSession(tab.id);
          connectionStatus = sessions.length > 0 ? 'connected' : 'no-media';
        } else {
          throw new Error('Medya içerik betiği geçerli bir yanıt döndürmedi.');
        }
      } catch {
        const lastResponseAt = portLastMessageAt.get(tab.id) ?? 0;
        if (Date.now() - lastResponseAt > 6_000) {
          disconnectMediaPort(tab.id);
          removeSession(tab.id);
          const recovered = await recoverMediaScripts(tab);
          if (recovered) scheduleDiscovery(150);
        }
      }
    }));

    for (const tabId of mediaPorts.keys()) {
      if (!openTabIds.has(tabId)) disconnectMediaPort(tabId);
    }
    sessions = sessions.filter((session) => openTabIds.has(session.tabId));
  }

  async function sendControl(command: MediaControl) {
    const target = activeSession;
    if (!target || controlPending) return;

    beginControl(target.tabId);
    const port = mediaPorts.get(target.tabId);
    if (port) {
      try {
        port.postMessage({ type: MEDIA_COMMAND, command });
        return;
      } catch {
        disconnectMediaPort(target.tabId);
      }
    }

    try {
      const response = await browser.tabs.sendMessage(target.tabId, {
        type: MEDIA_COMMAND,
        command,
      }) as MediaCommandResult | undefined;
      if (response?.state && isMediaSnapshot(response.state)) {
        upsertSession(target.tabId, target.windowId, response.state, Date.now());
      }
    } catch {
      removeSession(target.tabId);
    } finally {
      finishControl(target.tabId);
    }
  }

  async function focusMediaTab() {
    const target = activeSession;
    if (!target) return;
    try {
      await browser.tabs.update(target.tabId, { active: true });
      await browser.windows.update(target.windowId, { focused: true });
    } catch {
      removeSession(target.tabId);
    }
  }

  function sessionCurrentTimeAt(session: MediaSession, at: number): number {
    const { state } = session;
    const elapsed = state.paused || state.ended
      ? 0
      : Math.max(0, at - session.receivedAt) / 1000 * state.playbackRate;
    return Math.min(state.duration || Number.POSITIVE_INFINITY, state.currentTime + elapsed);
  }

  function estimatedCurrentTime(session: MediaSession | null): number {
    if (!session) return 0;
    return sessionCurrentTimeAt(session, now);
  }

  function handleSeekInput(event: Event) {
    seekPreview = Number((event.currentTarget as HTMLInputElement).value);
  }

  function commitSeek() {
    if (seekPreview === null) return;
    const time = seekPreview;
    seekPreview = null;
    void sendControl({ action: 'seek-to', time });
  }

  function handleMediaShortcut(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (
      !activeSession ||
      !shortcut ||
      event.isComposing ||
      event.repeat ||
      document.querySelector('[role="dialog"]') ||
      target?.closest('input, textarea, select, button, a, [role="textbox"]') ||
      target?.isContentEditable
    ) return;

    if (eventShortcut(event) !== shortcut) return;
    event.preventDefault();
    void sendControl({ action: 'toggle' });
  }

  function handleRuntimeMessage(message: unknown, sender: { tab?: { id?: number; windowId?: number; lastAccessed?: number } }) {
    if (!isMediaStateReport(message) || typeof sender.tab?.id !== 'number') return undefined;
    portLastMessageAt.set(sender.tab.id, Date.now());
    if (message.state) {
      connectionStatus = 'connected';
      upsertSession(
        sender.tab.id,
        sender.tab.windowId ?? -1,
        message.state,
        tabLastAccessed(sender.tab),
      );
    } else {
      removeSession(sender.tab.id);
      connectionStatus = sessions.length > 0 ? 'connected' : 'no-media';
    }
    return undefined;
  }

  function handleTabRemoved(tabId: number) {
    disconnectMediaPort(tabId);
    removeSession(tabId);
    connectionStatus = sessions.length > 0 ? 'connected' : 'searching';
    scheduleDiscovery(150);
  }

  function handleTabUpdated(tabId: number, changeInfo: { status?: string }) {
    if (changeInfo.status === 'loading') {
      disconnectMediaPort(tabId);
      removeSession(tabId);
      connectionStatus = 'connecting';
    } else if (changeInfo.status === 'complete') {
      scheduleDiscovery(150);
    }
  }

  function handleTabActivated(activeInfo: { tabId: number }) {
    const existing = sessions.find((session) => session.tabId === activeInfo.tabId);
    if (!existing) {
      scheduleDiscovery(150);
      return;
    }
    sessions = sessions.map((session) => session.tabId === activeInfo.tabId
      ? { ...session, lastAccessed: Date.now() }
      : session);
  }

  $: activeSession = [...sessions].sort(compareSessions)[0] ?? null;
  $: media = activeSession?.state ?? null;
  $: currentTime = seekPreview ?? estimatedCurrentTime(activeSession);
  $: duration = media?.duration ?? 0;
  $: progress = duration > 0 ? Math.min(100, Math.max(0, currentTime / duration * 100)) : 0;
  $: providerLabel = media?.provider === 'youtube-music' ? 'YouTube Music' : 'YouTube';
  $: artworkVisible = Boolean(media?.artworkUrl && media.artworkUrl !== artworkError);
  $: emptyCopy = CONNECTION_COPY[connectionStatus];

  onMount(() => {
    destroyed = false;
    clockInterval = window.setInterval(() => { now = Date.now(); }, 250);
    discoveryInterval = window.setInterval(() => void discoverSessions(), 10_000);
    window.addEventListener('keydown', handleMediaShortcut);
    browser.runtime.onMessage.addListener(handleRuntimeMessage);
    browser.tabs.onRemoved.addListener(handleTabRemoved);
    browser.tabs.onUpdated.addListener(handleTabUpdated);
    browser.tabs.onActivated.addListener(handleTabActivated);
    void discoverSessions();
  });

  onDestroy(() => {
    destroyed = true;
    if (clockInterval) window.clearInterval(clockInterval);
    if (discoveryInterval) window.clearInterval(discoveryInterval);
    if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
    if (controlTimeout) window.clearTimeout(controlTimeout);
    for (const tabId of [...mediaPorts.keys()]) disconnectMediaPort(tabId);
    recoveringTabs.clear();
    lastRecoveryAt.clear();
    window.removeEventListener('keydown', handleMediaShortcut);
    browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    browser.tabs.onRemoved.removeListener(handleTabRemoved);
    browser.tabs.onUpdated.removeListener(handleTabUpdated);
    browser.tabs.onActivated.removeListener(handleTabActivated);
  });
</script>

<Card ariaLabel="Medya oynatıcı" class="media-card">
  {#if activeSession && media}
    <div class="media-card__content" style={`--media-progress: ${progress}%`}>
      <div class="media-card__visual">
        <button
          type="button"
          class="media-card__artwork"
          title="Medya sekmesine git"
          aria-label={`${media.title} sekmesine git`}
          onclick={() => void focusMediaTab()}
        >
          {#if artworkVisible}
            <img
              src={media.artworkUrl}
              alt=""
              referrerpolicy="no-referrer"
              onerror={() => (artworkError = media?.artworkUrl ?? '')}
            />
          {:else}
            <Icon name="music" size={26} />
          {/if}
        </button>
      </div>

      <button
        type="button"
        class="media-card__metadata"
        title={`${media.title}${media.artist ? ` — ${media.artist}` : ''} · Sekmeye git`}
        onclick={() => void focusMediaTab()}
      >
        <strong>{media.title}</strong>
        <span>
          {media.artist || providerLabel}
          {#if media.artist}<span aria-hidden="true"> · </span>{providerLabel}{/if}
        </span>
      </button>

      <div class="media-card__media-area">
        <div class="media-card__timeline">
          {#if duration > 0}
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={currentTime}
              disabled={controlPending}
              aria-label="Medya konumu"
              aria-valuetext={`${formatMediaTime(currentTime)} / ${formatMediaTime(duration)}`}
              oninput={handleSeekInput}
              onchange={commitSeek}
              onblur={() => (seekPreview = null)}
            />
          {:else}
            <span class="media-card__live-track" aria-hidden="true"></span>
          {/if}
        </div>

        <div class="media-card__actions">
          <output class="media-card__time">
            {#if duration > 0}
              {formatMediaTime(currentTime)}/{formatMediaTime(duration)}
            {:else}
              Canlı
            {/if}
          </output>
          <div class="media-card__navigation">
            <IconButton
              label="Önceki medya"
              title="Önceki"
              variant="ghost"
              disabled={!media.canPrevious || controlPending}
              onclick={() => void sendControl({ action: 'previous' })}
            >
              <Icon name="previous" size={19} filled />
            </IconButton>
            <IconButton
              label={media.paused || media.ended ? 'Oynat' : 'Duraklat'}
              title={media.paused || media.ended ? 'Oynat' : 'Duraklat'}
              variant="ghost"
              disabled={controlPending}
              onclick={() => void sendControl({ action: 'toggle' })}
            >
              <Icon name={media.paused || media.ended ? 'play' : 'pause'} size={23} filled />
            </IconButton>
            <IconButton
              label="Sonraki medya"
              title="Sonraki"
              variant="ghost"
              disabled={!media.canNext || controlPending}
              onclick={() => void sendControl({ action: 'next' })}
            >
              <Icon name="next" size={19} filled />
            </IconButton>
          </div>
          <IconButton
            label="Medya ayarları"
            title="Kısayol ayarı"
            variant="ghost"
            onclick={onOpenSettings}
          >
            <Icon name="keyboard" size={17} />
          </IconButton>
        </div>
      </div>
    </div>
  {:else}
    <div class="media-card__content media-card__content--empty">
      <div class="media-card__visual">
        <div class="media-card__artwork media-card__artwork--empty" aria-hidden="true">
          <Icon name="music" size={26} />
        </div>
      </div>
      <div class="media-card__empty-copy">
        <strong>{emptyCopy.title}</strong>
        <span>{emptyCopy.description}</span>
      </div>
      <div class="media-card__media-area">
        <div class="media-card__timeline" aria-hidden="true">
          <span class="media-card__live-track"></span>
        </div>
        <div class="media-card__actions">
          <output class="media-card__time" aria-hidden="true">--:--/--:--</output>
          <IconButton
            label="Medya ayarları"
            title="Kısayol ayarı"
            variant="ghost"
            onclick={onOpenSettings}
          >
            <Icon name="keyboard" size={17} />
          </IconButton>
        </div>
      </div>
    </div>
  {/if}
</Card>

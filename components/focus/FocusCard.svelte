<script lang="ts">
  import { onMount } from 'svelte';
  import type { AppSettings, PomodoroMode, PomodoroState } from '../../lib/types';
  import {
    adjustRecoveredStopwatch,
    discardTimer,
    elapsedSeconds,
    finishTimer,
    remainingSeconds,
    requestCompletion,
    resetTimer,
    selectMode,
    toggleTimer,
  } from '../../lib/pomodoro';
  import { formatDuration } from '../../lib/utils';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import Dialog from '../ui/Dialog.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Input from '../ui/Input.svelte';
  import SegmentedToggle from '../ui/SegmentedToggle.svelte';
  import '../ui/form.css';
  import './focus.css';

  export let timer: PomodoroState;
  export let settings: AppSettings;
  export let onTimerChange: (timer: PomodoroState) => void;
  export let onOpenSettings: () => void;

  type TimerDialog = 'discard' | 'recovery-edit' | null;

  let displayValue = timer.mode === 'focus' ? remainingSeconds(timer) : elapsedSeconds(timer);
  let completionRequestedFor = '';
  let working = false;
  let error = '';
  let feedback = '';
  let activeTimerDialog: TimerDialog = null;
  let recoveryEndValue = '';

  const recoveryDateFormatter = new Intl.DateTimeFormat('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  $: if (timer.status !== 'running') {
    displayValue = timer.mode === 'focus' ? timer.remainingSec : timer.elapsedSec;
  }
  $: progress = timer.mode === 'focus' && timer.durationSec > 0
    ? Math.min(1, Math.max(0, 1 - displayValue / timer.durationSec))
    : timer.status === 'idle' ? 0 : 1;
  $: currentModeLabel = timer.mode === 'focus' ? 'Geri sayım' : 'Sayaç';
  $: statusLabel = timer.recovery
    ? 'Otomatik duraklatıldı'
    : timer.status === 'running'
      ? timer.mode === 'focus' ? 'Odak sürüyor' : 'Süre kaydediliyor'
      : timer.status === 'paused' ? 'Duraklatıldı' : 'Hazır';
  $: canReset = timer.status !== 'idle' || (timer.mode === 'stopwatch' && timer.elapsedSec > 0);
  $: modeOptions = [
    { value: 'focus', label: `${settings.pomodoro.focusMinutes} dk` },
    { value: 'stopwatch', label: 'Sayaç' },
  ];
  $: recoveryMessage = timer.recovery ? describeRecovery(timer.recovery) : '';

  onMount(() => {
    const tick = () => {
      if (timer.status !== 'running') return;
      displayValue = timer.mode === 'focus' ? remainingSeconds(timer) : elapsedSeconds(timer);
      if (
        timer.mode === 'focus'
        && displayValue === 0
        && timer.sessionId
        && completionRequestedFor !== timer.sessionId
      ) {
        completionRequestedFor = timer.sessionId;
        void requestCompletion(timer.sessionId).catch((completionError) => {
          error = completionError instanceof Error
            ? completionError.message
            : 'Tamamlanan odak kaydedilemedi.';
        });
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    const handleVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  });

  function compactDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.round(totalSeconds));
    const days = Math.floor(safeSeconds / 86400);
    const hours = Math.floor((safeSeconds % 86400) / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    if (days > 0) return `${days} gün${hours ? ` ${hours} sa` : ''}`;
    if (hours > 0) return `${hours} sa${minutes ? ` ${minutes} dk` : ''}`;
    if (minutes > 0) return `${minutes} dk`;
    return safeSeconds > 0 ? '<1 dk' : '0 dk';
  }

  function describeRecovery(recovery: NonNullable<PomodoroState['recovery']>): string {
    const stoppedAt = recoveryDateFormatter.format(new Date(recovery.recordedEndAt));
    if (recovery.reason === 'locked') {
      return `Ekran kilitlendiğinde sayaç ${stoppedAt} itibarıyla durduruldu.`;
    }
    const excluded = compactDuration(recovery.excludedSec);
    const reasons = {
      offline: 'Tarayıcı veya bilgisayar kapalıyken',
      idle: 'Hareketsizlik sırasında',
      checkin: 'Kontrol bildiriminden sonra',
      locked: '',
    };
    return `${reasons[recovery.reason]} geçen ${excluded} kaydedilmedi. Sayaç ${stoppedAt} itibarıyla durduruldu.`;
  }

  function toLocalDateTimeValue(timestamp: number): string {
    const date = new Date(timestamp);
    const local = new Date(timestamp - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 19);
  }

  function clearMessages() {
    error = '';
    feedback = '';
  }

  async function handleToggle() {
    if (working) return;
    working = true;
    clearMessages();
    try {
      onTimerChange(await toggleTimer(timer, settings));
    } catch (timerError) {
      error = timerError instanceof Error ? timerError.message : 'Sayaç güncellenemedi.';
    } finally {
      working = false;
    }
  }

  async function handleFinish() {
    if (working) return;
    working = true;
    clearMessages();
    const savedSeconds = elapsedSeconds(timer);
    try {
      onTimerChange(await finishTimer(timer, settings));
      feedback = `${compactDuration(savedSeconds)} odak süresi kaydedildi.`;
    } catch (timerError) {
      error = timerError instanceof Error ? timerError.message : 'Oturum bitirilemedi.';
    } finally {
      working = false;
    }
  }

  async function handleDiscard() {
    if (working) return;
    working = true;
    clearMessages();
    try {
      onTimerChange(await discardTimer(timer, settings));
      activeTimerDialog = null;
      feedback = 'Oturum kaydedilmeden silindi.';
    } catch (timerError) {
      error = timerError instanceof Error ? timerError.message : 'Oturum silinemedi.';
    } finally {
      working = false;
    }
  }

  async function handleReset() {
    if (working) return;
    working = true;
    clearMessages();
    try {
      onTimerChange(await resetTimer(timer, settings));
    } catch (timerError) {
      error = timerError instanceof Error ? timerError.message : 'Sayaç sıfırlanamadı.';
    } finally {
      working = false;
    }
  }

  async function handleMode(mode: PomodoroMode) {
    if (working || mode === timer.mode) return;
    working = true;
    clearMessages();
    try {
      onTimerChange(await selectMode(mode, timer, settings));
    } catch (timerError) {
      error = timerError instanceof Error ? timerError.message : 'Odak modu değiştirilemedi.';
    } finally {
      working = false;
    }
  }

  function openRecoveryEditor() {
    if (!timer.recovery) return;
    recoveryEndValue = toLocalDateTimeValue(timer.recovery.recordedEndAt);
    activeTimerDialog = 'recovery-edit';
  }

  async function handleRecoveryEdit() {
    if (working || !timer.recovery) return;
    const timestamp = new Date(recoveryEndValue).getTime();
    if (!Number.isFinite(timestamp)) {
      error = 'Lütfen geçerli bir bitiş zamanı seçin.';
      return;
    }
    if (timestamp < timer.recovery.segmentStartAt || timestamp > timer.recovery.detectedAt) {
      error = 'Bitiş zamanı oturum başlangıcı ile geri dönüş zamanı arasında olmalı.';
      return;
    }

    working = true;
    clearMessages();
    try {
      onTimerChange(await adjustRecoveredStopwatch(timer, timestamp));
      activeTimerDialog = null;
      feedback = 'Oturumun bitiş zamanı güncellendi.';
    } catch (timerError) {
      error = timerError instanceof Error ? timerError.message : 'Bitiş zamanı güncellenemedi.';
    } finally {
      working = false;
    }
  }
</script>

<Card title="Odak" headingId="focus-heading" class="focus-card">
  <svelte:fragment slot="action">
    <IconButton variant="ghost" label="Odak ayarları" onclick={onOpenSettings}>
      <Icon name="settings" size={16} />
    </IconButton>
  </svelte:fragment>

  <SegmentedToggle
    value={timer.mode}
    options={modeOptions}
    label="Odak modu"
    onChange={(mode) => void handleMode(mode as PomodoroMode)}
  />

  <div class:timer-stage--with-recovery={Boolean(timer.recovery)} class="timer-stage">
    <div
      class="timer-readout"
      role="timer"
      aria-label={`${currentModeLabel}: ${formatDuration(displayValue)}`}
    >
      <strong>{formatDuration(displayValue)}</strong>
      <span>{statusLabel}</span>
    </div>
    <div
      class:stopwatch={timer.mode === 'stopwatch'}
      class="timer-progress"
      role="progressbar"
      aria-label="Odak ilerlemesi"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(progress * 100)}
    >
      <span style={`width: ${progress * 100}%`}></span>
    </div>
  </div>

  {#if timer.recovery}
    <div class="timer-recovery" role="status">
      <div>
        <strong>Sayaç otomatik duraklatıldı</strong>
        <p>{recoveryMessage}</p>
      </div>
      <div class="timer-recovery__actions">
        <Button size="sm" disabled={working} onclick={handleToggle}>Devam et</Button>
        <Button size="sm" variant="outlined" disabled={working} onclick={handleFinish}>Bitir</Button>
        <button type="button" disabled={working} onclick={openRecoveryEditor}>Bitişi düzelt</button>
        <button type="button" disabled={working} onclick={() => (activeTimerDialog = 'discard')}>Oturumu sil</button>
      </div>
    </div>
  {:else if timer.mode === 'stopwatch'}
    <div class="timer-actions">
      {#if timer.status === 'running'}
        <IconButton label="Duraklat" variant="ghost" disabled={working} onclick={handleToggle}>
          <Icon name="pause" size={16} />
        </IconButton>
      {:else if timer.status === 'paused'}
        <IconButton label="Kaydetmeden vazgeç" variant="ghost" disabled={working} onclick={() => (activeTimerDialog = 'discard')}>
          <Icon name="trash" size={16} />
        </IconButton>
      {:else}
        <span class="timer-spacer" aria-hidden="true"></span>
      {/if}

      {#if timer.status === 'idle'}
        <Button variant="default" class="timer-primary" disabled={working} onclick={handleToggle}>
          <Icon name="play" size={17} />
          Başlat
        </Button>
      {:else}
        <Button variant="default" class="timer-primary" disabled={working} onclick={handleFinish}>
          <Icon name="stop" size={16} />
          Bitir ve kaydet
        </Button>
      {/if}

      {#if timer.status === 'paused'}
        <IconButton label="Devam et" variant="ghost" disabled={working} onclick={handleToggle}>
          <Icon name="play" size={16} />
        </IconButton>
      {:else if timer.status === 'running'}
        <IconButton label="Kaydetmeden vazgeç" variant="ghost" disabled={working} onclick={() => (activeTimerDialog = 'discard')}>
          <Icon name="trash" size={16} />
        </IconButton>
      {:else}
        <span class="timer-spacer" aria-hidden="true"></span>
      {/if}
    </div>
  {:else}
    <div class="timer-actions">
      <IconButton label="Sıfırla" variant="ghost" disabled={!canReset || working} onclick={handleReset}>
        <Icon name="reset" size={16} />
      </IconButton>
      <Button variant="default" class="timer-primary" disabled={working} onclick={handleToggle}>
        <Icon name={timer.status === 'running' ? 'pause' : 'play'} size={17} />
        {timer.status === 'running' ? 'Duraklat' : timer.status === 'paused' ? 'Devam et' : 'Başlat'}
      </Button>
      <span class="timer-spacer" aria-hidden="true"></span>
    </div>
  {/if}

  {#if error}<p class="form-error timer-message">{error}</p>{/if}
  {#if feedback}<p class="timer-feedback timer-message" role="status">{feedback}</p>{/if}
</Card>

{#if activeTimerDialog === 'discard'}
  <Dialog
    title="Oturum silinsin mi?"
    subtitle="Bu işlem geri alınamaz"
    onClose={() => (activeTimerDialog = null)}
    onCancel={() => (activeTimerDialog = null)}
    onConfirm={() => void handleDiscard()}
    confirmLabel="Oturumu sil"
    saving={working}
  >
    <p class="timer-dialog-copy">Bu oturumda kaydedilen {compactDuration(elapsedSeconds(timer))} istatistiklerden çıkarılacak.</p>
  </Dialog>
{/if}

{#if activeTimerDialog === 'recovery-edit' && timer.recovery}
  <Dialog
    title="Bitiş saatini düzelt"
    subtitle="Kaydedilmeyen aralığı ayarlayın"
    onClose={() => (activeTimerDialog = null)}
    onCancel={() => (activeTimerDialog = null)}
    formId="recovery-edit-form"
    confirmLabel="Güncelle"
    saving={working}
  >
    <form id="recovery-edit-form" class="dialog-form" onsubmit={(event) => { event.preventDefault(); void handleRecoveryEdit(); }}>
      <Input
        bind:value={recoveryEndValue}
        type="datetime-local"
        min={toLocalDateTimeValue(timer.recovery.segmentStartAt)}
        max={toLocalDateTimeValue(timer.recovery.detectedAt)}
        step={1}
        label="Oturum ne zaman bitti?"
        description="Seçtiğiniz zamana kadar olan süre çalışma kaydına dahil edilir."
        required
      />
      {#if error}<p class="form-error">{error}</p>{/if}
    </form>
  </Dialog>
{/if}

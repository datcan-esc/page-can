<script lang="ts">
  import { onMount } from 'svelte';
  import type { AppSettings, PomodoroMode, PomodoroState } from '../../lib/types';
  import {
    elapsedSeconds,
    remainingSeconds,
    requestCompletion,
    resetTimer,
    selectMode,
    toggleTimer,
  } from '../../lib/pomodoro';
  import { formatDuration } from '../../lib/utils';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import SegmentedToggle from '../ui/SegmentedToggle.svelte';
  import '../ui/form.css';
  import './focus.css';

  export let timer: PomodoroState;
  export let settings: AppSettings;
  export let onTimerChange: (timer: PomodoroState) => void;
  export let onOpenSettings: () => void;

  let displayValue = timer.mode === 'focus' ? remainingSeconds(timer) : elapsedSeconds(timer);
  let completionRequestedFor = '';
  let working = false;
  let error = '';

  $: if (timer.status !== 'running') {
    displayValue = timer.mode === 'focus' ? timer.remainingSec : timer.elapsedSec;
  }
  $: progress = timer.mode === 'focus' && timer.durationSec > 0
    ? Math.min(1, Math.max(0, 1 - displayValue / timer.durationSec))
    : timer.status === 'idle' ? 0 : 1;
  $: currentModeLabel = timer.mode === 'focus' ? 'Geri sayım' : 'Sayaç';
  $: statusLabel = timer.status === 'running'
    ? timer.mode === 'focus' ? 'Odak sürüyor' : 'Süre kaydediliyor'
    : timer.status === 'paused' ? 'Duraklatıldı' : 'Hazır';
  $: canReset = timer.status !== 'idle' || (timer.mode === 'stopwatch' && timer.elapsedSec > 0);
  $: modeOptions = [
    { value: 'focus', label: `${settings.pomodoro.focusMinutes} dk` },
    { value: 'stopwatch', label: 'Sayaç' },
  ];

  onMount(() => {
    const tick = () => {
      if (timer.status !== 'running') return;
      displayValue = timer.mode === 'focus' ? remainingSeconds(timer) : elapsedSeconds(timer);
      if (
        timer.mode === 'focus' &&
        displayValue === 0 &&
        timer.sessionId &&
        completionRequestedFor !== timer.sessionId
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

  async function handleToggle() {
    if (working) return;
    working = true;
    error = '';
    try {
      onTimerChange(await toggleTimer(timer, settings));
    } catch (timerError) {
      error = timerError instanceof Error ? timerError.message : 'Sayaç güncellenemedi.';
    } finally {
      working = false;
    }
  }

  async function handleReset() {
    if (working) return;
    working = true;
    error = '';
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
    error = '';
    try {
      onTimerChange(await selectMode(mode, timer, settings));
    } catch (timerError) {
      error = timerError instanceof Error ? timerError.message : 'Odak modu değiştirilemedi.';
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

  <div class="timer-stage">
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
  {#if error}<p class="form-error">{error}</p>{/if}
</Card>

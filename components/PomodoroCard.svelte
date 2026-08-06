<script lang="ts">
  import { onMount } from 'svelte';
  import type { AppSettings, PomodoroMode, PomodoroState } from '../lib/types';
  import {
    elapsedSeconds,
    remainingSeconds,
    requestCompletion,
    resetTimer,
    selectMode,
    toggleTimer,
  } from '../lib/pomodoro';
  import { formatDuration } from '../lib/utils';
  import BaseCard from './BaseCard.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';

  export let timer: PomodoroState;
  export let settings: AppSettings;
  export let onTimerChange: (timer: PomodoroState) => void;
  export let onOpenSettings: () => void;

  let displayValue = timer.mode === 'focus' ? remainingSeconds(timer) : elapsedSeconds(timer);
  let completionRequestedFor = '';

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
        void requestCompletion(timer.sessionId);
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
    onTimerChange(await toggleTimer(timer, settings));
  }

  async function handleReset() {
    onTimerChange(await resetTimer(timer, settings));
  }

  async function handleMode(mode: PomodoroMode) {
    if (mode === timer.mode) return;
    onTimerChange(await selectMode(mode, timer, settings));
  }
</script>

<BaseCard title="Odak" headingId="pomodoro-heading" class="pomodoro-card">
  <svelte:fragment slot="action">
    <IconButton label="Odak ayarları" onclick={onOpenSettings}>
      <Icon name="settings" size={16} />
    </IconButton>
  </svelte:fragment>

  <div class="focus-mode-picker" aria-label="Odak modu">
    <Button
      variant="unstyled"
      size="sm"
      class={timer.mode === 'focus' ? 'active' : ''}
      aria-pressed={timer.mode === 'focus'}
      onclick={() => handleMode('focus')}
    >{settings.pomodoro.focusMinutes} dk</Button>
    <Button
      variant="unstyled"
      size="sm"
      class={timer.mode === 'stopwatch' ? 'active' : ''}
      aria-pressed={timer.mode === 'stopwatch'}
      onclick={() => handleMode('stopwatch')}
    >Sayaç</Button>
  </div>

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
    <IconButton label="Sıfırla" variant="secondary" disabled={!canReset} onclick={handleReset}>
      <Icon name="reset" size={16} />
    </IconButton>
    <Button variant="primary" class="timer-primary" onclick={handleToggle}>
      <Icon name={timer.status === 'running' ? 'pause' : 'play'} size={17} />
      {timer.status === 'running' ? 'Duraklat' : timer.status === 'paused' ? 'Devam et' : 'Başlat'}
    </Button>
    <span class="timer-spacer" aria-hidden="true"></span>
  </div>
</BaseCard>

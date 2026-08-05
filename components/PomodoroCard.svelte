<script lang="ts">
  import { onMount } from 'svelte';
  import type { AppSettings, PomodoroMode, PomodoroState } from '../lib/types';
  import {
    requestCompletion,
    resetTimer,
    remainingSeconds,
    selectMode,
    toggleTimer,
  } from '../lib/pomodoro';
  import { formatDuration } from '../lib/utils';
  import BaseCard from './BaseCard.svelte';
  import Icon from './Icon.svelte';

  export let timer: PomodoroState;
  export let settings: AppSettings;
  export let onTimerChange: (timer: PomodoroState) => void;
  export let onOpenSettings: () => void;

  let displayRemaining = remainingSeconds(timer);
  let completionRequestedFor = '';

  const modes: { value: PomodoroMode; label: string }[] = [
    { value: 'focus', label: 'Odak' },
    { value: 'shortBreak', label: 'Kısa mola' },
    { value: 'longBreak', label: 'Uzun mola' },
  ];

  $: if (timer.status !== 'running') displayRemaining = timer.remainingSec;
  $: progress = timer.durationSec > 0
    ? Math.min(1, Math.max(0, 1 - displayRemaining / timer.durationSec))
    : 0;

  onMount(() => {
    const tick = () => {
      if (timer.status !== 'running') return;
      displayRemaining = remainingSeconds(timer);
      if (
        displayRemaining === 0 &&
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

<BaseCard title="Pomodoro" headingId="pomodoro-heading" class="pomodoro-card">
  <svelte:fragment slot="action">
    <button class="icon-button subtle" type="button" aria-label="Pomodoro ayarları" onclick={onOpenSettings}>
      <Icon name="settings" size={17} />
    </button>
  </svelte:fragment>

  <div class="segmented-control timer-modes" aria-label="Pomodoro modu">
    {#each modes as mode}
      <button
        class:active={timer.mode === mode.value}
        type="button"
        onclick={() => handleMode(mode.value)}
      >{mode.label}</button>
    {/each}
  </div>

  <div class="timer-shell" style={`--progress-angle: ${progress * 360}deg`}>
    <div class="timer-inner">
      <strong>{formatDuration(displayRemaining)}</strong>
      <span>{timer.status === 'running' ? 'Devam ediyor' : timer.status === 'paused' ? 'Duraklatıldı' : 'Hazır'}</span>
    </div>
  </div>

  <div class="timer-actions">
    <button class="icon-button timer-reset" type="button" aria-label="Sıfırla" onclick={handleReset}>
      <Icon name="reset" size={19} />
    </button>
    <button class="timer-primary" type="button" onclick={handleToggle}>
      <Icon name={timer.status === 'running' ? 'pause' : 'play'} size={21} />
      {timer.status === 'running' ? 'Duraklat' : timer.status === 'paused' ? 'Devam et' : 'Başlat'}
    </button>
    <span class="timer-spacer" aria-hidden="true"></span>
  </div>
</BaseCard>

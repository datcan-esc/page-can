<script lang="ts">
  import { onMount } from 'svelte';
  import type { DailyStat, PomodoroState } from '../../lib/types';
  import {
    averageActiveDayMinutes,
    formatFocusMinutes,
    makeMonthWeeks,
    withLiveFocus,
  } from '../../lib/stats';
  import Button from '../ui/Button.svelte';
  import Dialog from '../ui/Dialog.svelte';
  import Input from '../ui/Input.svelte';
  import '../ui/form.css';
  import './stats.css';

  export let stats: DailyStat[] = [];
  export let timer: PomodoroState;
  export let loading = false;
  export let onClose: () => void;
  export let onUpdateDay: (date: string, focusSeconds: number) => Promise<void>;

  let now = Date.now();
  let selectedDate = '';
  let editMinutes: string | number = 0;
  let editing = false;
  let editError = '';
  let editFeedback = '';
  const monthFormatter = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
  const selectedDateFormatter = new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  $: liveStats = withLiveFocus(stats, timer, now);
  $: weeks = makeMonthWeeks(liveStats, new Date(now));
  $: calendarDays = weeks.flat();
  $: monthDays = calendarDays.filter((item) => item.inMonth);
  $: elapsedMonthDays = monthDays.filter((item) => item.date.getTime() <= now);
  $: maxDailyMinutes = Math.max(1, ...monthDays.map((item) => item.minutes));
  $: totalMinutes = monthDays.reduce((total, item) => total + item.minutes, 0);
  $: averageMinutes = averageActiveDayMinutes(elapsedMonthDays);
  $: monthLabel = monthFormatter.format(new Date(now));

  onMount(() => {
    const interval = window.setInterval(() => (now = Date.now()), 10_000);
    return () => window.clearInterval(interval);
  });

  function formatHourMinute(minutes: number): string {
    const safeMinutes = Math.max(0, Math.round(minutes));
    return `${Math.floor(safeMinutes / 60)}.${String(safeMinutes % 60).padStart(2, '0')}`;
  }

  function dayStrength(minutes: number): number {
    if (minutes <= 0) return 0;
    return Math.round(12 + (minutes / maxDailyMinutes) * 56);
  }

  function selectDay(key: string) {
    const item = calendarDays.find((candidate) => candidate.key === key);
    if (!item?.inMonth || item.date.getTime() > now || timer.status !== 'idle') return;
    selectedDate = key;
    editMinutes = Math.round((stats.find((stat) => stat.date === key)?.focusSeconds ?? 0) / 60);
    editError = '';
    editFeedback = '';
  }

  function selectedDateLabel(): string {
    const [year, month, day] = selectedDate.split('-').map(Number);
    return selectedDateFormatter.format(new Date(
      year ?? 0,
      (month ?? 1) - 1,
      day ?? 1,
      12,
    ));
  }

  async function saveDay(minutes = Number(editMinutes)) {
    if (!selectedDate || editing) return;
    if (timer.status !== 'idle') {
      editError = 'Günlük kayıtları düzenlemeden önce açık oturumu bitirin veya silin.';
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
      editError = 'Günlük süre 0 ile 1440 dakika arasında olmalı.';
      return;
    }
    editing = true;
    editError = '';
    editFeedback = '';
    try {
      const roundedMinutes = Math.round(minutes);
      await onUpdateDay(selectedDate, roundedMinutes * 60);
      editMinutes = roundedMinutes;
      editFeedback = roundedMinutes > 0 ? 'Günlük odak süresi güncellendi.' : 'Günlük odak süresi silindi.';
    } catch (error) {
      editError = error instanceof Error ? error.message : 'Günlük odak süresi güncellenemedi.';
    } finally {
      editing = false;
    }
  }
</script>

<Dialog title={monthLabel} subtitle="Günlük odak dağılımı" {onClose} wide>
  {#if loading}
    <div class="modal-empty" role="status">Aylık odak verileri yükleniyor…</div>
  {:else}
    <div class="detail-stat-summary">
      <div><strong>{formatFocusMinutes(totalMinutes)}</strong><span>aylık toplam</span></div>
      <div><strong>{formatFocusMinutes(averageMinutes)}</strong><span>aktif gün ortalaması</span></div>
    </div>

    <div class="month-calendar" aria-label={`${monthLabel} günlük odak takvimi`}>
      <div class="month-calendar__weekdays" aria-hidden="true">
        {#each ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as weekday}
          <span>{weekday}</span>
        {/each}
      </div>

      <div class="month-calendar__days">
        {#each calendarDays as item (item.key)}
          <button
            type="button"
            class:today={item.isToday}
            class:outside={!item.inMonth}
            class:has-data={item.minutes > 0}
            class:selected={selectedDate === item.key}
            class:editing-disabled={timer.status !== 'idle'}
            class="month-day"
            style={`--day-strength: ${dayStrength(item.minutes)}%`}
            title={item.minutes > 0 ? `${item.key}: ${formatFocusMinutes(item.minutes)}` : `${item.key}: odak kaydı yok`}
            aria-label={item.minutes > 0
              ? `${item.dayNumber} ${item.label}, ${formatFocusMinutes(item.minutes)}`
              : `${item.dayNumber} ${item.label}, odak kaydı yok`}
            disabled={!item.inMonth || item.date.getTime() > now}
            aria-disabled={timer.status !== 'idle'}
            onclick={() => selectDay(item.key)}
          >
            <time datetime={item.key}>{item.dayNumber}</time>
            {#if item.inMonth && item.minutes > 0}<strong>{formatHourMinute(item.minutes)}</strong>{/if}
          </button>
        {/each}
      </div>
    </div>

    {#if timer.status !== 'idle'}
      <p class="day-stat-edit-note">Günlük kayıtları düzenlemek için açık odak oturumunu önce bitirin veya silin.</p>
    {/if}

    {#if selectedDate}
      <form class="day-stat-editor" onsubmit={(event) => { event.preventDefault(); void saveDay(); }}>
        <div class="day-stat-editor__heading">
          <strong>{selectedDateLabel()}</strong>
          <span>Yanlış veya unutulmuş bir kaydı buradan düzeltebilirsiniz.</span>
        </div>
        <Input
          bind:value={editMinutes}
          type="number"
          min={0}
          max={1440}
          suffix="dakika"
          label="Kaydedilecek toplam"
          required
        />
        <div class="day-stat-editor__actions">
          <Button type="button" size="sm" variant="ghost" disabled={editing} onclick={() => (selectedDate = '')}>Kapat</Button>
          <Button type="button" size="sm" variant="outlined" disabled={editing || Number(editMinutes) === 0} onclick={() => void saveDay(0)}>Kaydı sil</Button>
          <Button type="submit" size="sm" disabled={editing}>{editing ? 'Kaydediliyor…' : 'Güncelle'}</Button>
        </div>
        {#if editError}<p class="form-error">{editError}</p>{/if}
        {#if editFeedback}<p class="day-stat-editor__feedback" role="status">{editFeedback}</p>{/if}
      </form>
    {/if}
  {/if}
</Dialog>

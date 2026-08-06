<script lang="ts">
  import { onMount } from 'svelte';
  import type { DailyStat, PomodoroState } from '../../lib/types';
  import {
    averageActiveDayMinutes,
    formatFocusMinutes,
    makeMonthWeeks,
    withLiveFocus,
  } from '../../lib/stats';
  import Dialog from '../ui/Dialog.svelte';
  import './stats.css';

  export let stats: DailyStat[] = [];
  export let timer: PomodoroState;
  export let onClose: () => void;

  let now = Date.now();
  const monthFormatter = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });

  $: liveStats = withLiveFocus(stats, timer, now);
  $: weeks = makeMonthWeeks(liveStats, new Date(now));
  $: calendarDays = weeks.flat();
  $: monthDays = calendarDays.filter((item) => item.inMonth);
  $: elapsedMonthDays = monthDays.filter((item) => item.date.getTime() <= now);
  $: maxDailyMinutes = Math.max(1, ...monthDays.map((item) => item.minutes));
  $: totalMinutes = monthDays.reduce((total, item) => total + item.minutes, 0);
  $: totalSessions = monthDays.reduce((total, item) => total + item.sessions, 0);
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
</script>

<Dialog title={monthLabel} subtitle="Günlük odak dağılımı" {onClose} wide>
  <div class="detail-stat-summary">
    <div><strong>{formatFocusMinutes(totalMinutes)}</strong><span>aylık toplam</span></div>
    <div><strong>{formatFocusMinutes(averageMinutes)}</strong><span>aktif gün ortalaması</span></div>
    <div><strong>{totalSessions}</strong><span>tamamlanan geri sayım</span></div>
  </div>

  <div class="month-calendar" aria-label={`${monthLabel} günlük odak takvimi`}>
    <div class="month-calendar__weekdays" aria-hidden="true">
      {#each ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as weekday}
        <span>{weekday}</span>
      {/each}
    </div>

    <div class="month-calendar__days">
      {#each calendarDays as item (item.key)}
        <div
          class:today={item.isToday}
          class:outside={!item.inMonth}
          class:empty={item.minutes === 0}
          class="month-day"
          style={`--day-strength: ${dayStrength(item.minutes)}%`}
          title={`${item.key}: ${formatFocusMinutes(item.minutes)}`}
          aria-label={`${item.dayNumber} ${item.label}, ${formatFocusMinutes(item.minutes)}`}
        >
          <time datetime={item.key}>{item.dayNumber}</time>
          {#if item.inMonth}<strong>{formatHourMinute(item.minutes)}</strong>{/if}
        </div>
      {/each}
    </div>

    <div class="month-calendar__legend" aria-hidden="true">
      <span>0.00</span>
      <i></i>
      <span>{formatHourMinute(maxDailyMinutes)} sa.dk</span>
    </div>
  </div>
</Dialog>

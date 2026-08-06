<script lang="ts">
  import { onMount } from 'svelte';
  import type { DailyStat, PomodoroState } from '../lib/types';
  import {
    averageActiveDayMinutes,
    focusChartScale,
    formatFocusMinutes,
    makeMonthWeeks,
    withLiveFocus,
  } from '../lib/stats';
  import BaseDialog from './BaseDialog.svelte';

  export let stats: DailyStat[] = [];
  export let timer: PomodoroState;
  export let onClose: () => void;

  let now = Date.now();
  const monthFormatter = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });

  $: liveStats = withLiveFocus(stats, timer, now);
  $: weeks = makeMonthWeeks(liveStats, new Date(now));
  $: monthDays = weeks.flat().filter((item) => item.inMonth);
  $: elapsedMonthDays = monthDays.filter((item) => item.date.getTime() <= now);
  $: maxMinutes = focusChartScale(monthDays.map((item) => item.minutes)).maxMinutes;
  $: totalMinutes = monthDays.reduce((total, item) => total + item.minutes, 0);
  $: totalSessions = monthDays.reduce((total, item) => total + item.sessions, 0);
  $: averageMinutes = averageActiveDayMinutes(elapsedMonthDays);
  $: monthLabel = monthFormatter.format(new Date(now));

  onMount(() => {
    const interval = window.setInterval(() => (now = Date.now()), 10_000);
    return () => window.clearInterval(interval);
  });
</script>

<BaseDialog
  title={monthLabel}
  subtitle="Haftalara göre odak süresi"
  {onClose}
  wide
>
  <div class="detail-stat-summary">
    <div><strong>{formatFocusMinutes(totalMinutes)}</strong><span>aylık toplam</span></div>
    <div><strong>{formatFocusMinutes(averageMinutes)}</strong><span>aktif gün ortalaması</span></div>
    <div><strong>{totalSessions}</strong><span>tamamlanan geri sayım</span></div>
  </div>

  <div class="month-weeks" aria-label={`${monthLabel} odak grafiği`}>
    {#each weeks as week, weekIndex}
      <section class="month-week">
        <header>
          <strong>{weekIndex + 1}. hafta</strong>
          <span>{formatFocusMinutes(week.filter((item) => item.inMonth).reduce((sum, item) => sum + item.minutes, 0))}</span>
        </header>
        <div class="week-chart">
          {#each week as item (item.key)}
            <div
              class:today={item.isToday}
              class:outside={!item.inMonth}
              class="week-day"
              title={`${item.key}: ${item.minutes} dakika`}
            >
              <time datetime={item.key}>{item.dayNumber}</time>
              <div class="week-bar-track">
                {#if item.minutes > 0}
                  <span style={`height: ${(item.minutes / maxMinutes) * 100}%`}></span>
                {/if}
              </div>
              <small>{item.label}</small>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</BaseDialog>

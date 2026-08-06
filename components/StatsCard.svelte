<script lang="ts">
  import { onMount } from 'svelte';
  import type { DailyStat, PomodoroState } from '../lib/types';
  import {
    averageActiveDayMinutes,
    focusChartScale,
    makeWeekSeries,
    withLiveFocus,
  } from '../lib/stats';
  import BaseCard from './BaseCard.svelte';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';

  export let stats: DailyStat[] = [];
  export let timer: PomodoroState;
  export let onShowDetails: () => void;

  let now = Date.now();

  $: liveStats = withLiveFocus(stats, timer, now);
  $: series = makeWeekSeries(liveStats, new Date(now));
  $: chartScale = focusChartScale(series.map((item) => item.minutes));
  $: chartMaxMinutes = chartScale.maxMinutes;
  $: totalMinutes = series.reduce((total, item) => total + item.minutes, 0);
  $: todayMinutes = series.find((item) => item.isToday)?.minutes ?? 0;
  $: averageMinutes = averageActiveDayMinutes(series.filter((item) => item.date.getTime() <= now));

  onMount(() => {
    const interval = window.setInterval(() => (now = Date.now()), 10_000);
    return () => window.clearInterval(interval);
  });

  function compactDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} dk`;
    return `${(minutes / 60).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sa`;
  }
</script>

<BaseCard title="Bu hafta" headingId="stats-heading" class="stats-card">
  <svelte:fragment slot="action">
    <IconButton label="Odak detaylarını aç" title="Detaylar" onclick={onShowDetails}>
      <Icon name="arrow" size={16} />
    </IconButton>
  </svelte:fragment>

  <div class="stat-summary">
    <div><strong>{compactDuration(todayMinutes)}</strong><span>bugün</span></div>
    <div><strong>{compactDuration(totalMinutes)}</strong><span>haftalık</span></div>
    <div><strong>{compactDuration(averageMinutes)}</strong><span>haftalık ort.</span></div>
  </div>

  <div class="focus-chart" aria-label="Bu haftanın saat ölçekli odak grafiği">
    <div class="chart-scale" aria-hidden="true">
      {#each chartScale.hourTicks as tick}
        <span style={`bottom: ${(tick / chartMaxMinutes) * 100}%`}>{tick / 60}</span>
      {/each}
    </div>
    <div class="chart-main">
      <div class="chart-plot">
        <div class="chart-grid" aria-hidden="true">
          {#each chartScale.hourTicks as tick}
            <span style={`bottom: ${(tick / chartMaxMinutes) * 100}%`}></span>
          {/each}
        </div>
        <div class="chart-bars">
          {#each series as item (item.key)}
            <div
              class:today={item.isToday}
              class:future={item.date.getTime() > now}
              class="chart-bar"
              title={`${item.label}: ${item.minutes} dakika`}
              aria-label={`${item.label}: ${item.minutes} dakika`}
            >
              {#if item.minutes > 0}
                <span style={`height: ${(item.minutes / chartMaxMinutes) * 100}%`}></span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
      <div class="chart-days" aria-hidden="true">
        {#each series as item (item.key)}
          <small class:today={item.isToday} class:future={item.date.getTime() > now}>
            {item.isToday ? 'Bugün' : item.label}
          </small>
        {/each}
      </div>
    </div>
  </div>
</BaseCard>

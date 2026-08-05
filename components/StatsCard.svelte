<script lang="ts">
  import type { DailyStat } from '../lib/types';
  import { makeFocusSeries } from '../lib/stats';
  import BaseCard from './BaseCard.svelte';
  import Icon from './Icon.svelte';

  export let stats: DailyStat[] = [];
  export let onShowDetails: () => void;

  $: series = makeFocusSeries(stats, 7);
  $: maxMinutes = Math.max(25, ...series.map((item) => item.minutes));
  $: totalMinutes = series.reduce((total, item) => total + item.minutes, 0);
  $: totalSessions = series.reduce((total, item) => total + item.sessions, 0);
</script>

<BaseCard title="Odak özeti" headingId="stats-heading" class="stats-card">
  <div class="stat-summary">
    <div><strong>{totalMinutes}</strong><span>dakika</span></div>
    <div><strong>{totalSessions}</strong><span>seans</span></div>
  </div>

  <div class="bar-chart" aria-label="Son 7 günlük odak grafiği">
    {#each series as item (item.key)}
      <div class="bar-column" title={`${item.label}: ${item.minutes} dakika`}>
        <div class="bar-track">
          <span style={`height: ${Math.max(item.minutes ? 8 : 2, (item.minutes / maxMinutes) * 100)}%`}></span>
        </div>
        <small>{item.label}</small>
      </div>
    {/each}
  </div>

  <svelte:fragment slot="footer">
    <button class="text-link" type="button" onclick={onShowDetails}>
      Detaya bak <Icon name="arrow" size={14} />
    </button>
  </svelte:fragment>
</BaseCard>

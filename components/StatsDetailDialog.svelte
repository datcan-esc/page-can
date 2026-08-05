<script lang="ts">
  import type { DailyStat } from '../lib/types';
  import { makeFocusSeries } from '../lib/stats';
  import BaseDialog from './BaseDialog.svelte';

  export let stats: DailyStat[] = [];
  export let onClose: () => void;

  $: series = makeFocusSeries(stats, 30);
  $: maxMinutes = Math.max(25, ...series.map((item) => item.minutes));
  $: totalMinutes = series.reduce((total, item) => total + item.minutes, 0);
  $: totalSessions = series.reduce((total, item) => total + item.sessions, 0);
</script>

<BaseDialog title="Son 30 gün" subtitle="Odak çalışma özeti" {onClose} wide>
  <div class="detail-stat-summary">
    <div><strong>{totalMinutes}</strong><span>dakika odak</span></div>
    <div><strong>{totalSessions}</strong><span>tamamlanan seans</span></div>
  </div>

  <div class="bar-chart detail-chart" aria-label="Son 30 günlük odak grafiği">
    {#each series as item (item.key)}
      <div class="bar-column" title={`${item.key}: ${item.minutes} dakika`}>
        <div class="bar-track">
          <span style={`height: ${Math.max(item.minutes ? 6 : 2, (item.minutes / maxMinutes) * 100)}%`}></span>
        </div>
        <small>{item.label}</small>
      </div>
    {/each}
  </div>
</BaseDialog>

<script context="module" lang="ts">
  export interface SegmentedOption {
    value: string;
    label: string;
  }
</script>

<script lang="ts">
  import Button from './Button.svelte';
  import './segmented-toggle.css';

  export let value: string;
  export let options: SegmentedOption[];
  export let onChange: (value: string) => void;
  export let label: string;
</script>

<div class="segmented-toggle" role="group" aria-label={label}>
  {#each options as option (option.value)}
    <Button
      variant="ghost"
      size="sm"
      class={value === option.value ? 'segmented-toggle__option active' : 'segmented-toggle__option'}
      aria-pressed={value === option.value}
      onclick={() => onChange(option.value)}
    >{option.label}</Button>
  {/each}
</div>

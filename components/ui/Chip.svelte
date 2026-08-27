<script lang="ts">
  import Badge from './Badge.svelte';
  import './chip.css';

  export let color = 'var(--primary)';
  export let selected = false;
  export let disabled = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  let className = '';
  export { className as class };
</script>

<button
  {...$$restProps}
  {type}
  {disabled}
  class:chip--selected={selected}
  class={`chip ${className}`.trim()}
>
  <Badge {color} variant={selected ? 'soft' : 'outline'} class="chip__badge">
    <slot />
  </Badge>
</button>

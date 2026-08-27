<script lang="ts">
  import Badge, { type BadgeVariant } from './Badge.svelte';
  import './chip.css';

  export let color = 'var(--primary)';
  export let variant: BadgeVariant = 'soft';
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
  data-state={selected ? 'active' : 'inactive'}
  class:chip--selected={selected}
  class={`chip ${className}`.trim()}
>
  <Badge {color} {variant} class="chip__badge">
    <slot />
  </Badge>
</button>

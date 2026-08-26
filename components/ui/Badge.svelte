<script context="module" lang="ts">
  export type BadgeVariant = 'soft' | 'solid' | 'outline';
  export type BadgeSize = 'sm' | 'md';
</script>

<script lang="ts">
  import './badge.css';

  export let color = 'var(--primary)';
  export let variant: BadgeVariant = 'soft';
  export let size: BadgeSize = 'sm';
  let className = '';
  export { className as class };
</script>

<span
  class={`badge badge--${variant} badge--${size} ${className}`.trim()}
  style={`--badge-color: ${color}`}
><slot /></span>

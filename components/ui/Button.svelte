<script context="module" lang="ts">
  export type ButtonVariant = 'default' | 'ghost' | 'outlined';
  export type ButtonSize = 'sm' | 'md';
</script>

<script lang="ts">
  import './button.css';

  export let variant: ButtonVariant = 'default';
  export let size: ButtonSize = 'md';
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let disabled = false;
  let className = '';
  export { className as class };
</script>

<button
  {...$$restProps}
  {type}
  {disabled}
  class={`button button--${variant} button--${size} ${className}`.trim()}
>
  <slot />
</button>

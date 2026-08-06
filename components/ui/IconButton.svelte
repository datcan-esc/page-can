<script context="module" lang="ts">
  export type IconButtonVariant = 'outlined' | 'ghost';
</script>

<script lang="ts">
  import Button, { type ButtonSize } from './Button.svelte';
  import './icon-button.css';

  export let label: string;
  export let title = '';
  export let variant: IconButtonVariant = 'outlined';
  export let size: ButtonSize = 'sm';
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let disabled = false;
  let className = '';
  export { className as class };
</script>

<Button
  {...$$restProps}
  {variant}
  {size}
  {type}
  {disabled}
  class={`icon-button icon-button--${variant} ${className}`.trim()}
  aria-label={label}
  title={title || label}
>
  <slot />
</Button>

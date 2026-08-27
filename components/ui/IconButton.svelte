<script context="module" lang="ts">
  export type IconButtonVariant = 'outlined' | 'ghost';
</script>

<script lang="ts">
  import Button, { type ButtonSize, type ButtonTone } from './Button.svelte';
  import './icon-button.css';

  export let label: string;
  export let title = '';
  export let variant: IconButtonVariant = 'outlined';
  export let size: ButtonSize = 'sm';
  export let tone: ButtonTone = 'neutral';
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let disabled = false;
  let className = '';
  export { className as class };
</script>

<Button
  {...$$restProps}
  {variant}
  {size}
  {tone}
  {type}
  {disabled}
  class={`icon-button icon-button--${variant} ${className}`.trim()}
  aria-label={label}
  title={title || label}
>
  <slot />
</Button>

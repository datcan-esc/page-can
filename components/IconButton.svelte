<script lang="ts">
  import Button, { type ButtonSize, type ButtonVariant } from './Button.svelte';

  export let label: string;
  export let title = '';
  export let variant: ButtonVariant = 'surface';
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
  class={`ui-icon-button ${className}`.trim()}
  aria-label={label}
  title={title || label}
>
  <slot />
</Button>

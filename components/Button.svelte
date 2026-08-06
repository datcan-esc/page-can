<script context="module" lang="ts">
  export type ButtonVariant = 'primary' | 'secondary' | 'surface' | 'ghost' | 'text' | 'unstyled';
  export type ButtonSize = 'sm' | 'md';
</script>

<script lang="ts">
  export let variant: ButtonVariant = 'secondary';
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
  class={`ui-button ui-button--${variant} ui-button--${size} ${className}`.trim()}
>
  <slot />
</button>

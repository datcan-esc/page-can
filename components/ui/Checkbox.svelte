<script lang="ts">
  import Icon from './Icon.svelte';
  import './checkbox.css';

  export let checked = false;
  export let disabled = false;
  export let label: string;
  export let onChange: (checked: boolean) => void;
  let className = '';
  export { className as class };
</script>

<button
  {...$$restProps}
  type="button"
  class:checked
  class={`checkbox ${className}`.trim()}
  role="checkbox"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={() => onChange(!checked)}
>
  {#if checked}<Icon name="check" size={13} strokeWidth={2.5} />{/if}
</button>

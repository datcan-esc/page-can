<script lang="ts">
  import { formatShortcut } from '../../lib/utils';
  import './shortcut-hint.css';

  export let shortcut = '';
  export let visible = false;
  let className = '';
  export { className as class };
</script>

{#if visible && shortcut}
  <kbd class={`shortcut-hint ${className}`.trim()} aria-hidden="true">
    {formatShortcut(shortcut)}
  </kbd>
{/if}

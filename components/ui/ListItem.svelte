<script lang="ts">
  import './list.css';

  export let expanded = false;
  export let muted = false;
  export let divider = false;
  let className = '';
  export { className as class };
</script>

<div
  class:expanded
  class:muted
  class:has-divider={divider}
  class:has-leading={Boolean($$slots.leading)}
  class={`list-item ${className}`.trim()}
  role="listitem"
>
  {#if $$slots.leading}<div class="list-item__leading"><slot name="leading" /></div>{/if}
  <div class="list-item__content"><slot /></div>
  {#if $$slots.actions}<div class="list-item__actions"><slot name="actions" /></div>{/if}
</div>

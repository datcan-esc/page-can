<script lang="ts">
  import './empty-state.css';

  export let text = '';
  export let status = false;
  let className = '';
  export { className as class };
</script>

<div class={`empty-state ${className}`.trim()} role={status ? 'status' : undefined}>
  <slot>{text}</slot>
</div>

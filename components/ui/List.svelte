<script lang="ts">
  import './list.css';

  let className = '';
  export { className as class };
</script>

<div class={`list ${className}`.trim()} role="list">
  <slot />
</div>

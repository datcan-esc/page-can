<script lang="ts">
  import './list.css';

  export let element: HTMLDivElement | undefined = undefined;
  let className = '';
  export { className as class };
</script>

<div {...$$restProps} bind:this={element} class={`list ${className}`.trim()} role="list">
  <slot />
</div>

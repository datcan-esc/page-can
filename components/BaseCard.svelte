<script lang="ts">
  export let title: string;
  export let headingId: string;
  export let style = '';
  let className = '';
  export { className as class };
</script>

<section class={`base-card ${className}`} {style} aria-labelledby={headingId}>
  <header class="base-card__header">
    <h2 id={headingId}>{title}</h2>
    {#if $$slots.action}
      <div class="base-card__action"><slot name="action" /></div>
    {/if}
  </header>

  <div class="base-card__body"><slot /></div>

  {#if $$slots.footer}
    <footer class="base-card__footer"><slot name="footer" /></footer>
  {/if}
</section>

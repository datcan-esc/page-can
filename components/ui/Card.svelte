<script lang="ts">
  import { createId } from '../../lib/utils';
  import './card.css';

  export let title = '';
  export let headingId = createId('card-heading');
  export let ariaLabel = '';
  export let bodyClass = '';
  let className = '';
  export { className as class };
</script>

<section
  class={`card ${className}`}
  aria-labelledby={title ? headingId : undefined}
  aria-label={!title && ariaLabel ? ariaLabel : undefined}
>
  {#if title || $$slots.action}
    <header class="card__header">
      {#if title}<h2 id={headingId}>{title}</h2>{/if}
      {#if $$slots.action}
        <div class="card__action"><slot name="action" /></div>
      {/if}
    </header>
  {/if}

  <div class={`card__body ${bodyClass}`.trim()}><slot /></div>

  {#if $$slots.footer}
    <footer class="card__footer"><slot name="footer" /></footer>
  {/if}
</section>

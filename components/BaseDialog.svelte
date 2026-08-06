<script lang="ts">
  import { onMount } from 'svelte';
  import { createId } from '../lib/utils';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';

  export let title: string;
  export let subtitle = '';
  export let wide = false;
  export let onClose: () => void;

  const headingId = createId('dialog-title');
  const focusableSelector = [
    '[autofocus]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'a[href]',
  ].join(',');

  let panel: HTMLElement;

  onMount(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      const preferred = panel.querySelector<HTMLElement>('[data-autofocus]');
      (preferred ?? panel.querySelector<HTMLElement>(focusableSelector))?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dialog-backdrop" role="presentation" onclick={handleBackdrop}>
  <div
    bind:this={panel}
    class:wide
    class="dialog-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby={headingId}
  >
    <header class="dialog-header">
      <div>
        <h2 id={headingId}>{title}</h2>
        {#if subtitle}<p>{subtitle}</p>{/if}
      </div>
      <IconButton label="Kapat" onclick={onClose}>
        <Icon name="close" size={18} />
      </IconButton>
    </header>
    <div class="dialog-content"><slot /></div>
    {#if $$slots.footer}
      <footer class="dialog-footer"><slot name="footer" /></footer>
    {/if}
  </div>
</div>

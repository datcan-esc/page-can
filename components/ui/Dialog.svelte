<script lang="ts">
  import { onMount } from 'svelte';
  import { createId } from '../../lib/utils';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';
  import './dialog.css';

  export let title: string;
  export let subtitle = '';
  export let wide = false;
  export let onClose: () => void;
  export let onCancel: (() => void) | undefined = undefined;
  export let onConfirm: (() => void) | undefined = undefined;
  export let confirmLabel = '';
  export let cancelLabel = 'Vazgeç';
  export let formId = '';
  export let saving = false;
  export let confirmDisabled = false;

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

  function cancel() {
    (onCancel ?? onClose)();
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
      <div class="dialog-heading">
        <h2 id={headingId}>{title}</h2>
        {#if subtitle}
          <span class="dialog-heading__divider" aria-hidden="true"></span>
          <p>{subtitle}</p>
        {/if}
      </div>
      <div class="dialog-header__actions">
        {#if $$slots['header-actions']}<slot name="header-actions" />{/if}
        <IconButton label="Kapat" variant="ghost" onclick={onClose}>
          <Icon name="close" size={18} />
        </IconButton>
      </div>
    </header>
    <div class="dialog-content"><slot /></div>
    {#if confirmLabel || $$slots['footer-leading']}
      <footer class="dialog-footer">
        {#if $$slots['footer-leading']}<slot name="footer-leading" />{/if}
        <span class="dialog-footer__spacer"></span>
        <Button variant="outlined" onclick={cancel}>{cancelLabel}</Button>
        {#if confirmLabel}
          <Button
            type={formId ? 'submit' : 'button'}
            form={formId || undefined}
            disabled={saving || confirmDisabled}
            onclick={() => { if (!formId) onConfirm?.(); }}
          >
            {saving ? 'Kaydediliyor…' : confirmLabel}
          </Button>
        {/if}
      </footer>
    {/if}
  </div>
</div>

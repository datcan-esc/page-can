<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    countScratchpadWords,
    normalizeScratchpadText,
    SCRATCHPAD_CHARACTER_LIMIT,
    SCRATCHPAD_WORD_LIMIT,
  } from '../../lib/scratchpad';
  import { createId } from '../../lib/utils';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import './scratchpad.css';

  export let text: string;
  export let saveState: 'saving' | 'saved' | 'error' = 'saved';
  export let onChange: (text: string) => void;
  export let onClose: () => void;
  export let onCopyError: (error: unknown) => void;

  const titleId = createId('scratchpad-title');
  const statusId = createId('scratchpad-status');
  let panel: HTMLElement;
  let textarea: HTMLTextAreaElement;
  let copied = false;
  let copyResetTimer: number | undefined;

  $: wordCount = countScratchpadWords(text);
  $: atLimit = wordCount >= SCRATCHPAD_WORD_LIMIT
    || text.length >= SCRATCHPAD_CHARACTER_LIMIT;
  $: saveLabel = saveState === 'saving'
    ? 'Kaydediliyor…'
    : saveState === 'error'
      ? 'Kaydedilemedi'
      : 'Kaydedildi';

  onMount(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  });

  onDestroy(() => {
    if (copyResetTimer) window.clearTimeout(copyResetTimer);
  });

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLTextAreaElement;
    const next = normalizeScratchpadText(target.value);
    if (next !== target.value) {
      const cursor = Math.min(target.selectionStart, next.length);
      target.value = next;
      target.setSelectionRange(cursor, cursor);
    }
    onChange(next);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll<HTMLElement>('textarea, button:not([disabled])')]
      .filter((element) => element.offsetParent !== null);
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

  async function copyText() {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch (clipboardError) {
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      textarea.focus();
      textarea.select();
      const didCopy = document.execCommand('copy');
      textarea.setSelectionRange(selectionStart, selectionEnd);
      if (!didCopy) {
        onCopyError(clipboardError);
        return;
      }
    }

    copied = true;
    if (copyResetTimer) window.clearTimeout(copyResetTimer);
    copyResetTimer = window.setTimeout(() => { copied = false; }, 1_600);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="scratchpad-backdrop" role="presentation" onclick={handleBackdrop}>
  <div
    bind:this={panel}
    class="scratchpad-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
  >
    <h2 id={titleId} class="visually-hidden">Metin alanı</h2>

    <textarea
      bind:this={textarea}
      value={text}
      maxlength={SCRATCHPAD_CHARACTER_LIMIT}
      placeholder="Promptunu veya metnini buraya yaz…"
      aria-label="Metin alanı"
      aria-describedby={statusId}
      oninput={handleInput}
    ></textarea>

    <div class="scratchpad-actions">
      <IconButton
        label={copied ? 'Kopyalandı' : 'Metni kopyala'}
        title={copied ? 'Kopyalandı' : 'Kopyala'}
        variant="ghost"
        class={copied ? 'copied' : ''}
        disabled={!text}
        onclick={() => void copyText()}
      >
        <Icon name={copied ? 'check' : 'copy'} size={17} />
      </IconButton>
      <IconButton label="Kapat" variant="ghost" onclick={onClose}>
        <Icon name="close" size={18} />
      </IconButton>
    </div>

    <div id={statusId} class:at-limit={atLimit} class="scratchpad-status" aria-live="polite">
      <span>{wordCount.toLocaleString('tr-TR')} / {SCRATCHPAD_WORD_LIMIT.toLocaleString('tr-TR')} kelime</span>
      <span class="scratchpad-status__divider" aria-hidden="true"></span>
      <span>{saveLabel}</span>
    </div>
  </div>
</div>

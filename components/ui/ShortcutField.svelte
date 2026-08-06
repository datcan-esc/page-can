<script lang="ts">
  import { formatShortcut, shortcutFromEvent } from '../../lib/utils';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import './shortcut-field.css';

  export let value = '';
  export let onChange: (shortcut: string) => void;
  export let label = 'Klavye kısayolu';
  export let description = 'Yeni sekmede bir yazı alanı odakta değilken çalışır.';

  let recording = false;

  function capture(event: KeyboardEvent) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      recording = false;
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      onChange('');
      recording = false;
      return;
    }

    const shortcut = shortcutFromEvent(event);
    if (!shortcut) return;
    onChange(shortcut);
    recording = false;
  }
</script>

<div class="shortcut-field">
  <div class="shortcut-field__copy">
    <span>{label}</span>
    <small>{description}</small>
  </div>

  <div class="shortcut-field__control">
    <Button
      variant="outlined"
      class={recording ? 'shortcut-field__recorder recording' : 'shortcut-field__recorder'}
      aria-pressed={recording}
      onkeydown={capture}
      onclick={() => (recording = true)}
      onblur={() => (recording = false)}
    >
      <Icon name="keyboard" size={16} />
      <kbd>{recording ? 'Tuşa basın…' : value ? formatShortcut(value) : 'Kısayol ata'}</kbd>
    </Button>

    {#if value}
      <Button variant="ghost" class="shortcut-field__remove" onclick={() => onChange('')}>
        <Icon name="close" size={15} />
        Kaldır
      </Button>
    {/if}
  </div>
</div>

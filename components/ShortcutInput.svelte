<script lang="ts">
  import { formatShortcut, shortcutFromEvent } from '../lib/utils';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';

  export let value = '';
  export let onChange: (shortcut: string) => void;
  export let label = 'Kısayol';

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

<div class="shortcut-control">
  <span>{label}</span>
  <div class="shortcut-control-actions">
    <Button
      variant="secondary"
      size="sm"
      class={recording ? 'shortcut-recorder recording' : 'shortcut-recorder'}
      onkeydown={capture}
      onclick={() => (recording = true)}
      onblur={() => (recording = false)}
    >
      <Icon name="keyboard" size={16} />
      {recording ? 'Tuşa basın…' : value ? formatShortcut(value) : 'Atanmamış'}
    </Button>
    {#if value}
      <IconButton label="Kısayolu kaldır" variant="ghost" onclick={() => onChange('')}>
        <Icon name="close" size={15} />
      </IconButton>
    {/if}
  </div>
</div>

<script lang="ts">
  import { shortcutFromEvent } from '../lib/utils';
  import Icon from './Icon.svelte';

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
  <button
    class:recording
    class="shortcut-recorder"
    type="button"
    onkeydown={capture}
    onclick={() => (recording = true)}
    onblur={() => (recording = false)}
  >
    <Icon name="keyboard" size={17} />
    {recording ? 'Tuşlara basın…' : value || 'Atanmamış'}
  </button>
</div>

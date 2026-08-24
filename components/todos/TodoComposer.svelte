<script lang="ts">
  import Input from '../ui/Input.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import ShortcutHint from '../ui/ShortcutHint.svelte';
  import './todos.css';

  export let onAdd: (title: string) => void;
  export let placeholder = 'Bir görev ekle';
  export let shortcut = '';
  export let showShortcutHints = false;
  export let focusRequest = 0;

  let value = '';
  let inputField: Input;
  let handledFocusRequest = focusRequest;

  $: if (focusRequest !== handledFocusRequest) {
    handledFocusRequest = focusRequest;
    inputField?.focus();
  }

  function submit() {
    const title = value.trim();
    if (!title) return;
    onAdd(title);
    value = '';
  }
</script>

<form class="todo-composer" onsubmit={(event) => { event.preventDefault(); submit(); }}>
  <Input bind:this={inputField} bind:value maxLength={160} {placeholder} aria-label="Yeni yapılacak">
    <svelte:fragment slot="trailing">
      <IconButton label="Görevi ekle" variant="ghost" type="submit" class="todo-submit" disabled={!value.trim()}>
        <Icon name="arrow-up" size={15} strokeWidth={2.2} />
      </IconButton>
    </svelte:fragment>
  </Input>
  <ShortcutHint
    {shortcut}
    visible={showShortcutHints}
    class="todo-shortcut-hint"
  />
</form>

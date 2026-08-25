<script lang="ts">
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import ShortcutHint from '../ui/ShortcutHint.svelte';
  import TodoTextField from './TodoTextField.svelte';
  import './todos.css';

  export let onAdd: (title: string) => void;
  export let placeholder = 'Bir görev ekle';
  export let shortcut = '';
  export let showShortcutHints = false;
  export let focusRequest = 0;

  let value = '';
  let inputField: TodoTextField;
  let handledFocusRequest = focusRequest;

  $: if (focusRequest !== handledFocusRequest) {
    handledFocusRequest = focusRequest;
    inputField?.focus();
  }

  function submit(title: string) {
    if (!title) return;
    onAdd(title);
    value = '';
  }
</script>

<form class="todo-composer" onsubmit={(event) => { event.preventDefault(); inputField.commit(); }}>
  <TodoTextField
    bind:this={inputField}
    bind:value
    {placeholder}
    ariaLabel="Yeni yapılacak"
    instruction="Enter ile ekle. Shift+Enter ile yeni satır ekle."
    onCommit={submit}
    trailing
  >
    <svelte:fragment slot="trailing">
      <IconButton label="Görevi ekle" variant="ghost" type="submit" class="todo-submit" disabled={!value.trim()}>
        <Icon name="arrow-up" size={15} strokeWidth={2.2} />
      </IconButton>
    </svelte:fragment>
  </TodoTextField>
  <ShortcutHint
    {shortcut}
    visible={showShortcutHints}
    class="todo-shortcut-hint"
  />
</form>

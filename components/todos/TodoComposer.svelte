<script lang="ts">
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import ShortcutHint from '../ui/ShortcutHint.svelte';
  import { parseTodoDraft } from '../../lib/todos';
  import type { TodoTag } from '../../lib/types';
  import TodoTextField from './TodoTextField.svelte';
  import './todo-composer.css';

  export let onAdd: (title: string, tagNames: string[]) => void;
  export let tags: TodoTag[] = [];
  export let placeholder = 'Görev ekle · # ile etiketle';
  export let shortcut = '';
  export let showShortcutHints = false;
  export let focusRequest = 0;

  let value = '';
  let inputField: TodoTextField;
  let handledFocusRequest = focusRequest;

  $: canSubmit = Boolean(parseTodoDraft(value).title);

  $: if (focusRequest !== handledFocusRequest) {
    handledFocusRequest = focusRequest;
    inputField?.focus();
  }

  function submit(draft: string) {
    const parsed = parseTodoDraft(draft);
    if (!parsed.title) return;
    onAdd(parsed.title, parsed.tagNames);
    value = '';
  }
</script>

<form class="todo-composer" onsubmit={(event) => { event.preventDefault(); inputField.commit(); }}>
  <TodoTextField
    bind:this={inputField}
    bind:value
    {placeholder}
    ariaLabel="Yeni yapılacak"
    instruction="Başta # ile etiket ekle. Enter ile ekle, Shift+Enter ile yeni satır aç."
    onCommit={submit}
    {tags}
    enableTagSuggestions
    trailing
  >
    <svelte:fragment slot="trailing">
      <IconButton label="Görevi ekle" variant="ghost" tone="primary" type="submit" disabled={!canSubmit}>
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

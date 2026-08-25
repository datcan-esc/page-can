<script lang="ts">
  import { flip } from 'svelte/animate';
  import { onMount, tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import { normalizeTodoText } from '../../lib/todos';
  import type { Todo } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import List from '../ui/List.svelte';
  import ListItem from '../ui/ListItem.svelte';
  import ListLimitNote from '../ui/ListLimitNote.svelte';
  import TodoTextField from './TodoTextField.svelte';
  import './todos.css';

  export let todos: Todo[];
  export let onChange: (todos: Todo[]) => void;
  export let emptyText = 'Bu listede görev yok.';
  export let limitNote = '';
  export let onLimitClick: (() => void) | undefined = undefined;

  let editingId = '';
  let editingTitle = '';
  let expandedId = '';
  let editingInput: TodoTextField | undefined;
  let motionDuration = 170;

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) motionDuration = 0;
  });

  function toggle(todo: Todo) {
    const pendingTitle = editingId === todo.id ? normalizeTodoText(editingTitle) : '';
    onChange(todos.map((item) => {
      if (item.id !== todo.id) return item;
      const completed = !item.completed;
      return {
        ...item,
        ...(pendingTitle ? { title: pendingTitle } : {}),
        completed,
        completedAt: completed ? Date.now() : undefined,
      };
    }));
    if (editingId === todo.id) cancelEdit();
  }

  function toggleExpanded(todo: Todo) {
    expandedId = expandedId === todo.id ? '' : todo.id;
  }

  async function beginEdit(todo: Todo) {
    expandedId = '';
    editingId = todo.id;
    editingTitle = todo.title;
    await tick();
    editingInput?.focusAtEnd();
  }

  function finishEdit(value = editingTitle) {
    if (!editingId) return;
    const title = normalizeTodoText(value);
    if (title) {
      onChange(todos.map((item) => item.id === editingId ? { ...item, title } : item));
    }
    editingId = '';
    editingTitle = '';
    expandedId = '';
  }

  function cancelEdit() {
    editingId = '';
    editingTitle = '';
    expandedId = '';
  }

  function remove(id: string) {
    if (editingId === id) cancelEdit();
    onChange(todos.filter((item) => item.id !== id));
  }

  function handleEditAction(todo: Todo) {
    if (editingId === todo.id) {
      finishEdit();
      return;
    }
    void beginEdit(todo);
  }
</script>

<List class="todo-rows">
  {#each todos as todo, index (todo.id)}
    <div
      class="todo-motion"
      animate:flip={{ duration: motionDuration }}
      out:slide={{ duration: motionDuration, axis: 'y' }}
    >
      <ListItem
        divider={index < todos.length - 1}
        expanded={editingId === todo.id || expandedId === todo.id}
        muted={todo.completed}
        class={`todo-row${todo.completed ? ' completed' : ''}${editingId === todo.id ? ' editing' : ''}`}
      >
        <svelte:fragment slot="leading">
          <Button
            variant="ghost"
            class="todo-check"
            aria-label={todo.completed ? 'Yapılacaklara geri taşı' : 'Tamamlandı olarak işaretle'}
            onmousedown={(event: MouseEvent) => {
              if (editingId === todo.id) event.preventDefault();
            }}
            onclick={() => toggle(todo)}
          >
            {#if todo.completed}<Icon name="check" size={13} strokeWidth={2.5} />{/if}
          </Button>
        </svelte:fragment>

        {#if editingId === todo.id}
          <TodoTextField
            bind:this={editingInput}
            bind:value={editingTitle}
            class="todo-edit-field"
            ariaLabel="Yapılacak metnini düzenle"
            instruction="Enter ile kaydet. Shift+Enter ile yeni satır ekle. Escape ile vazgeç."
            onCommit={finishEdit}
            onCancel={cancelEdit}
            commitOnBlur
          />
        {:else}
          <Button
            variant="ghost"
            class="todo-title"
            aria-expanded={expandedId === todo.id}
            title={expandedId === todo.id ? 'Metni daralt' : 'Metnin tamamını göster'}
            onclick={() => toggleExpanded(todo)}
          >
            {todo.title}
          </Button>
        {/if}

        <svelte:fragment slot="actions">
          <IconButton
            variant="ghost"
            label={editingId === todo.id ? 'Kaydet' : 'Düzenle'}
            onmousedown={(event: MouseEvent) => {
              if (editingId === todo.id) event.preventDefault();
            }}
            onclick={() => handleEditAction(todo)}
          >
            <Icon name={editingId === todo.id ? 'check' : 'edit'} size={14} strokeWidth={editingId === todo.id ? 2.4 : 1.8} />
          </IconButton>
          <IconButton
            variant="ghost"
            label="Sil"
            onmousedown={(event: MouseEvent) => {
              if (editingId === todo.id) event.preventDefault();
            }}
            onclick={() => remove(todo.id)}
          >
            <Icon name="close" size={14} />
          </IconButton>
        </svelte:fragment>
      </ListItem>
    </div>
  {:else}
    <div class="card-empty todo-empty">
      <Icon name="check" size={20} />
      <p>{emptyText}</p>
    </div>
  {/each}
  {#if limitNote && onLimitClick}
    <ListLimitNote text={limitNote} onShowAll={onLimitClick} />
  {/if}
</List>

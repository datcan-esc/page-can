<script lang="ts">
  import { flip } from 'svelte/animate';
  import { onMount, tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { Todo } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import List from '../ui/List.svelte';
  import ListItem from '../ui/ListItem.svelte';
  import ListLimitNote from '../ui/ListLimitNote.svelte';
  import './todos.css';

  export let todos: Todo[];
  export let onChange: (todos: Todo[]) => void;
  export let emptyText = 'Bu listede görev yok.';
  export let limitNote = '';
  export let onLimitClick: (() => void) | undefined = undefined;

  let editingId = '';
  let editingTitle = '';
  let expandedId = '';
  let editingInput: HTMLInputElement | undefined;
  let motionDuration = 170;

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) motionDuration = 0;
  });

  function toggle(todo: Todo) {
    onChange(todos.map((item) => item.id === todo.id
      ? {
          ...item,
          completed: !item.completed,
          completedAt: !item.completed ? Date.now() : undefined,
        }
      : item));
  }

  function toggleExpanded(todo: Todo) {
    expandedId = expandedId === todo.id ? '' : todo.id;
  }

  async function beginEdit(todo: Todo) {
    expandedId = '';
    editingId = todo.id;
    editingTitle = todo.title;
    await tick();
    editingInput?.focus();
    editingInput?.select();
  }

  function finishEdit() {
    if (!editingId) return;
    const title = editingTitle.trim();
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
  {#each todos as todo (todo.id)}
    <div
      class="todo-motion"
      animate:flip={{ duration: motionDuration }}
      out:slide={{ duration: motionDuration, axis: 'y' }}
    >
      <ListItem
        expanded={editingId !== todo.id && expandedId === todo.id}
        muted={todo.completed}
        class={`todo-row${todo.completed ? ' completed' : ''}${editingId === todo.id ? ' editing' : ''}`}
      >
        <svelte:fragment slot="leading">
          <Button
            variant="ghost"
            class="todo-check"
            aria-label={todo.completed ? 'Yapılacaklara geri taşı' : 'Tamamlandı olarak işaretle'}
            onclick={() => toggle(todo)}
          >
            {#if todo.completed}<Icon name="check" size={13} strokeWidth={2.5} />{/if}
          </Button>
        </svelte:fragment>

        {#if editingId === todo.id}
          <input
            bind:this={editingInput}
            class="todo-edit-input"
            bind:value={editingTitle}
            type="text"
            maxlength={160}
            onkeydown={(event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                finishEdit();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelEdit();
              }
            }}
            onblur={finishEdit}
            aria-label="Yapılacak başlığını düzenle"
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
          <IconButton variant="ghost" label="Sil" onclick={() => remove(todo.id)}>
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

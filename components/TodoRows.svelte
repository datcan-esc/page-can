<script lang="ts">
  import { flip } from 'svelte/animate';
  import { onMount, tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { Todo } from '../lib/types';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';

  export let todos: Todo[];
  export let onChange: (todos: Todo[]) => void;
  export let emptyText = 'Bu listede görev yok.';

  let editingId = '';
  let editingTitle = '';
  let expandedId = '';
  let editingInput: HTMLTextAreaElement;
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
    expandedId = todo.id;
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
  }

  function cancelEdit() {
    editingId = '';
    editingTitle = '';
  }

  function remove(id: string) {
    onChange(todos.filter((item) => item.id !== id));
  }
</script>

<div class="todo-rows">
  {#each todos as todo (todo.id)}
    <div
      class:completed={todo.completed}
      class:expanded={expandedId === todo.id}
      class="todo-row"
      animate:flip={{ duration: motionDuration }}
      out:slide={{ duration: motionDuration, axis: 'y' }}
    >
      <Button
        variant="unstyled"
        class="todo-check"
        aria-label={todo.completed ? 'Yapılacaklara geri taşı' : 'Tamamlandı olarak işaretle'}
        onclick={() => toggle(todo)}
      >
        {#if todo.completed}<Icon name="check" size={13} strokeWidth={2.5} />{/if}
      </Button>

      {#if editingId === todo.id}
        <textarea
          bind:this={editingInput}
          class="todo-edit-input"
          bind:value={editingTitle}
          maxlength="160"
          rows="2"
          onkeydown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) finishEdit();
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelEdit();
            }
          }}
          onblur={finishEdit}
          aria-label="Yapılacak başlığını düzenle"
        ></textarea>
      {:else}
        <Button
          variant="unstyled"
          class="todo-title"
          aria-expanded={expandedId === todo.id}
          title={expandedId === todo.id ? 'Metni daralt' : 'Metnin tamamını göster'}
          onclick={() => toggleExpanded(todo)}
        >
          {todo.title}
        </Button>
      {/if}

      <div class="row-actions">
        <IconButton label="Düzenle" onclick={() => beginEdit(todo)}>
          <Icon name="edit" size={14} />
        </IconButton>
        <IconButton label="Sil" onclick={() => remove(todo.id)}>
          <Icon name="close" size={14} />
        </IconButton>
      </div>
    </div>
  {:else}
    <div class="card-empty todo-empty">
      <Icon name="check" size={20} />
      <p>{emptyText}</p>
    </div>
  {/each}
</div>

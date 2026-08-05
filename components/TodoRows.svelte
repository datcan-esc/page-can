<script lang="ts">
  import type { Todo } from '../lib/types';
  import Icon from './Icon.svelte';

  export let todos: Todo[];
  export let onChange: (todos: Todo[]) => void;

  let editingId = '';
  let editingTitle = '';

  function toggle(todo: Todo) {
    onChange(todos.map((item) => item.id === todo.id
      ? {
          ...item,
          completed: !item.completed,
          completedAt: !item.completed ? Date.now() : undefined,
        }
      : item));
  }

  function beginEdit(todo: Todo) {
    editingId = todo.id;
    editingTitle = todo.title;
  }

  function finishEdit() {
    const title = editingTitle.trim();
    if (title) {
      onChange(todos.map((item) => item.id === editingId ? { ...item, title } : item));
    }
    editingId = '';
    editingTitle = '';
  }

  function remove(id: string) {
    onChange(todos.filter((item) => item.id !== id));
  }
</script>

<div class="todo-rows">
  {#each todos as todo (todo.id)}
    <div class:completed={todo.completed} class="todo-row">
      <button
        class="todo-check"
        type="button"
        aria-label={todo.completed ? 'Yapılacaklara geri taşı' : 'Tamamlandı olarak işaretle'}
        onclick={() => toggle(todo)}
      >
        {#if todo.completed}<Icon name="check" size={15} strokeWidth={2.2} />{/if}
      </button>

      {#if editingId === todo.id}
        <input
          class="todo-edit-input"
          bind:value={editingTitle}
          onkeydown={(event) => {
            if (event.key === 'Enter') finishEdit();
            if (event.key === 'Escape') editingId = '';
          }}
          onblur={finishEdit}
          aria-label="Yapılacak başlığını düzenle"
        />
      {:else}
        <button class="todo-title" type="button" ondblclick={() => beginEdit(todo)} onclick={() => toggle(todo)}>
          {todo.title}
        </button>
      {/if}

      <div class="row-actions">
        <button class="icon-button subtle" type="button" aria-label="Düzenle" onclick={() => beginEdit(todo)}>
          <Icon name="edit" size={15} />
        </button>
        <button class="icon-button subtle danger" type="button" aria-label="Sil" onclick={() => remove(todo.id)}>
          <Icon name="trash" size={15} />
        </button>
      </div>
    </div>
  {:else}
    <div class="card-empty todo-empty">
      <Icon name="check" size={22} />
      <p>Bu görünüm şimdilik tertemiz.</p>
    </div>
  {/each}
</div>

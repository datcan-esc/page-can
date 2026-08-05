<script lang="ts">
  import type { Todo } from '../lib/types';
  import { createId } from '../lib/utils';
  import BaseCard from './BaseCard.svelte';
  import Icon from './Icon.svelte';
  import TodoRows from './TodoRows.svelte';

  export let todos: Todo[];
  export let onChange: (todos: Todo[]) => void;
  export let onShowAll: () => void;

  let tab: 'active' | 'completed' = 'active';
  let newTodo = '';

  $: filtered = todos
    .filter((todo) => tab === 'completed' ? todo.completed : !todo.completed)
    .sort((left, right) => tab === 'completed'
      ? (right.completedAt ?? 0) - (left.completedAt ?? 0)
      : right.createdAt - left.createdAt);
  $: visible = filtered.slice(0, 15);

  function addTodo() {
    const title = newTodo.trim();
    if (!title) return;
    onChange([
      ...todos,
      {
        id: createId('todo'),
        title,
        completed: false,
        createdAt: Date.now(),
      },
    ]);
    newTodo = '';
    tab = 'active';
  }

  function updateVisible(updated: Todo[]) {
    const updatedMap = new Map(updated.map((todo) => [todo.id, todo]));
    const visibleIds = new Set(visible.map((todo) => todo.id));
    onChange([
      ...todos.filter((todo) => !visibleIds.has(todo.id)),
      ...updated.filter((todo) => updatedMap.has(todo.id)),
    ]);
  }
</script>

<BaseCard title="Yapılacaklar" headingId="todo-heading" class="todo-card">
  <form class="todo-add" onsubmit={(event) => { event.preventDefault(); addTodo(); }}>
    <input bind:value={newTodo} maxlength="160" placeholder="Yeni bir yapılacak ekle…" aria-label="Yeni yapılacak" />
    <button class="primary-icon-button" type="submit" aria-label="Ekle">
      <Icon name="plus" size={18} />
    </button>
  </form>

  <div class="segmented-control todo-tabs" aria-label="Yapılacak görünümü">
    <button class:active={tab === 'active'} type="button" onclick={() => (tab = 'active')}>Yapılacaklar</button>
    <button class:active={tab === 'completed'} type="button" onclick={() => (tab = 'completed')}>Tamamlananlar</button>
  </div>

  <TodoRows todos={visible} onChange={updateVisible} />

  <svelte:fragment slot="footer">
    <button class="text-link" type="button" onclick={onShowAll}>
      Tümünü gör <Icon name="arrow" size={14} />
    </button>
  </svelte:fragment>
</BaseCard>

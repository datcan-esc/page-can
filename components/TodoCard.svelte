<script lang="ts">
  import type { Todo } from '../lib/types';
  import { createId } from '../lib/utils';
  import BaseCard from './BaseCard.svelte';
  import Button from './Button.svelte';
  import TodoComposer from './TodoComposer.svelte';
  import TodoRows from './TodoRows.svelte';

  export let todos: Todo[];
  export let onChange: (todos: Todo[]) => void;
  export let onShowAll: () => void;

  $: activeTodos = todos
    .filter((todo) => !todo.completed)
    .sort((left, right) => right.createdAt - left.createdAt);
  $: visible = activeTodos.slice(0, 15);

  function addTodo(title: string) {
    onChange([
      ...todos,
      {
        id: createId('todo'),
        title,
        completed: false,
        createdAt: Date.now(),
      },
    ]);
  }

  function updateVisible(updated: Todo[]) {
    const visibleIds = new Set(visible.map((todo) => todo.id));
    onChange([
      ...todos.filter((todo) => !visibleIds.has(todo.id)),
      ...updated,
    ]);
  }
</script>

<BaseCard title="Yapılacaklar" headingId="todo-heading" class="todo-card">
  <svelte:fragment slot="action">
    <Button variant="text" size="sm" onclick={onShowAll}>Tümü</Button>
  </svelte:fragment>

  <TodoComposer onAdd={addTodo} />
  <TodoRows
    todos={visible}
    onChange={updateVisible}
    emptyText="Bugün için açık görev yok."
  />
</BaseCard>

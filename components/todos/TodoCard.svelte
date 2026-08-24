<script lang="ts">
  import type { Todo } from '../../lib/types';
  import { TODO_CARD_LIMIT } from '../../lib/display-limits';
  import { createId } from '../../lib/utils';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import TodoComposer from './TodoComposer.svelte';
  import TodoRows from './TodoRows.svelte';
  import './todos.css';

  export let todos: Todo[];
  export let shortcut = '';
  export let showShortcutHints = false;
  export let focusRequest = 0;
  export let onChange: (todos: Todo[]) => void;
  export let onShowAll: () => void;

  $: activeTodos = todos
    .filter((todo) => !todo.completed)
    .sort((left, right) => right.createdAt - left.createdAt);
  $: visible = activeTodos.slice(0, TODO_CARD_LIMIT);

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

<Card title="Yapılacaklar" headingId="todo-heading" class="todo-card">
  <svelte:fragment slot="action">
    <Button variant="ghost" size="sm" onclick={onShowAll}>Tümü</Button>
  </svelte:fragment>

  <TodoComposer
    onAdd={addTodo}
    {shortcut}
    {showShortcutHints}
    {focusRequest}
  />
  <TodoRows
    todos={visible}
    onChange={updateVisible}
    emptyText="Bugün için açık görev yok."
    limitNote={activeTodos.length >= TODO_CARD_LIMIT
      ? `${TODO_CARD_LIMIT} açık görev gösteriliyor. Daha fazlası için`
      : ''}
    onLimitClick={onShowAll}
  />
</Card>

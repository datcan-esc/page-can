<script lang="ts">
  import type { Todo } from '../lib/types';
  import { createId } from '../lib/utils';
  import BaseDialog from './BaseDialog.svelte';
  import Icon from './Icon.svelte';
  import TodoComposer from './TodoComposer.svelte';
  import TodoRows from './TodoRows.svelte';

  export let todos: Todo[];
  export let onClose: () => void;
  export let onChange: (todos: Todo[]) => void;

  let query = '';

  $: normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  $: active = todos
    .filter((todo) => !todo.completed)
    .filter(matchesQuery)
    .sort((left, right) => right.createdAt - left.createdAt);
  $: completed = todos
    .filter((todo) => todo.completed)
    .filter(matchesQuery)
    .sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0));
  $: activeCount = todos.filter((todo) => !todo.completed).length;
  $: completedCount = todos.length - activeCount;

  function matchesQuery(todo: Todo) {
    return todo.title.toLocaleLowerCase('tr-TR').includes(normalizedQuery);
  }

  function addTodo(title: string) {
    onChange([
      ...todos,
      { id: createId('todo'), title, completed: false, createdAt: Date.now() },
    ]);
  }

  function updateSubset(original: Todo[], updated: Todo[]) {
    const originalIds = new Set(original.map((todo) => todo.id));
    onChange([
      ...todos.filter((todo) => !originalIds.has(todo.id)),
      ...updated,
    ]);
  }
</script>

<BaseDialog
  title="Yapılacaklar"
  subtitle={`${activeCount} açık · ${completedCount} tamamlanan`}
  {onClose}
  wide
>
  <div class="todos-modal-toolbar">
    <TodoComposer onAdd={addTodo} />
    <div class="search-field compact-search">
      <Icon name="search" size={16} />
      <input bind:value={query} placeholder="Görevlerde ara" aria-label="Yapılacaklarda ara" />
    </div>
  </div>

  <div class="todo-sections">
    <section class="todo-section" aria-labelledby="active-todos-heading">
      <header>
        <strong id="active-todos-heading">Yapılacaklar</strong>
        <span>{active.length}</span>
      </header>
      <TodoRows
        todos={active}
        onChange={(updated) => updateSubset(active, updated)}
        emptyText={normalizedQuery ? 'Aramana uygun açık görev yok.' : 'Açık görev yok.'}
      />
    </section>

    <section class="todo-section" aria-labelledby="completed-todos-heading">
      <header>
        <strong id="completed-todos-heading">Tamamlananlar</strong>
        <span>{completed.length}</span>
      </header>
      <TodoRows
        todos={completed}
        onChange={(updated) => updateSubset(completed, updated)}
        emptyText={normalizedQuery ? 'Aramana uygun tamamlanan görev yok.' : 'Henüz tamamlanan görev yok.'}
      />
    </section>
  </div>
</BaseDialog>

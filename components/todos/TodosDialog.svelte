<script lang="ts">
  import type { Todo } from '../../lib/types';
  import { createId } from '../../lib/utils';
  import Dialog from '../ui/Dialog.svelte';
  import Input from '../ui/Input.svelte';
  import TodoComposer from './TodoComposer.svelte';
  import TodoRows from './TodoRows.svelte';
  import '../ui/form.css';
  import './todos.css';

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

<Dialog
  title="Yapılacaklar"
  subtitle={`${activeCount} açık · ${completedCount} tamamlanan`}
  {onClose}
  wide
>
  <div class="todos-modal-toolbar">
    <TodoComposer onAdd={addTodo} />
    <Input
      bind:value={query}
      type="search"
      icon="search"
      class="todo-search"
      placeholder="Görevlerde ara"
      aria-label="Yapılacaklarda ara"
    />
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
</Dialog>

<script lang="ts">
  import type { Todo } from '../../lib/types';
  import Dialog from '../ui/Dialog.svelte';
  import Input from '../ui/Input.svelte';
  import TodoRows from './TodoRows.svelte';
  import '../ui/form.css';
  import './todos.css';

  export let todos: Todo[];
  export let loading = false;
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
  function matchesQuery(todo: Todo) {
    return todo.title.toLocaleLowerCase('tr-TR').includes(normalizedQuery);
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
  subtitle={`${todos.length}`}
  {onClose}
  wide
>
  <div class="todos-dialog-layout">
    <Input
      bind:value={query}
      type="search"
      icon="search"
      class="todo-search"
      placeholder="Yapılacaklar ve tamamlananlarda ara"
      aria-label="Yapılacaklarda ara"
    />

    <div class="todo-sections">
      <section class="todo-section" aria-labelledby="active-todos-heading">
        <header>
          <strong id="active-todos-heading">Yapılacaklar</strong>
          <span class="todo-section__divider" aria-hidden="true"></span>
          <span class="todo-section__count">{active.length}</span>
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
          <span class="todo-section__divider" aria-hidden="true"></span>
          <span class="todo-section__count">{completed.length}</span>
        </header>
        {#if loading}
          <div class="card-empty todo-empty" role="status">Tamamlanan görevler yükleniyor…</div>
        {:else}
          <TodoRows
            todos={completed}
            onChange={(updated) => updateSubset(completed, updated)}
            emptyText={normalizedQuery ? 'Aramana uygun tamamlanan görev yok.' : 'Henüz tamamlanan görev yok.'}
          />
        {/if}
      </section>
    </div>
  </div>
</Dialog>

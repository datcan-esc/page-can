<script lang="ts">
  import { onMount } from 'svelte';
  import type { Todo, TodoTag } from '../../lib/types';
  import Dialog from '../ui/Dialog.svelte';
  import Input from '../ui/Input.svelte';
  import TodoFilters from './TodoFilters.svelte';
  import TodoRows from './TodoRows.svelte';
  import TodoTagManager from './TodoTagManager.svelte';
  import '../ui/form.css';
  import './todos.css';

  export let todos: Todo[];
  export let tags: TodoTag[];
  export let selectedTagId = '';
  export let loading = false;
  export let tagManagementReady = false;
  export let onClose: () => void;
  export let onChange: (todos: Todo[], tags?: TodoTag[]) => void;
  export let onFilterChange: (tagId: string) => void;

  let query = '';
  let managingTags = false;
  let filterDirection = 1;
  let motionDuration = 170;

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) motionDuration = 0;
  });

  $: normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  $: tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  $: active = todos
    .filter((todo) => !todo.completed)
    .filter(matchesTag)
    .filter(matchesQuery)
    .sort((left, right) => right.createdAt - left.createdAt);
  $: completed = todos
    .filter((todo) => todo.completed)
    .filter(matchesTag)
    .filter(matchesQuery)
    .sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0));
  function matchesQuery(todo: Todo) {
    if (!normalizedQuery) return true;
    return todo.title.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
      || todo.tagIds.some((tagId) =>
        tagsById.get(tagId)?.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery));
  }

  function matchesTag(todo: Todo) {
    return !selectedTagId || todo.tagIds.includes(selectedTagId);
  }

  function updateSubset(original: Todo[], updated: Todo[], nextTags = tags) {
    const originalIds = new Set(original.map((todo) => todo.id));
    onChange([
      ...todos.filter((todo) => !originalIds.has(todo.id)),
      ...updated,
    ], nextTags);
  }

  function selectFilter(tagId: string, direction: number) {
    filterDirection = direction;
    onFilterChange(tagId);
  }

  function updateWorkspace(nextTodos: Todo[], nextTags: TodoTag[]) {
    if (selectedTagId && !nextTags.some((tag) => tag.id === selectedTagId)) {
      onFilterChange('');
    }
    onChange(nextTodos, nextTags);
  }
</script>

<Dialog
  title="Yapılacaklar"
  subtitle={`${todos.length}`}
  {onClose}
  wide
>
  <div class="todos-dialog-layout">
    {#if !managingTags}
      <Input
        bind:value={query}
        type="search"
        icon="search"
        class="todo-search"
        placeholder="Görevlerde veya etiketlerde ara"
        aria-label="Yapılacaklarda ara"
      />
    {/if}

    <TodoFilters
      {tags}
      {selectedTagId}
      onSelect={selectFilter}
      onManage={() => (managingTags = !managingTags)}
      managing={managingTags}
      manageDisabled={loading || !tagManagementReady}
    />

    {#if managingTags}
      <TodoTagManager {tags} {todos} onChange={updateWorkspace} />
    {:else}
    {#key selectedTagId}
    <div
      class:todo-filter-page--backward={filterDirection < 0}
      class="todo-filter-page todo-filter-page--dialog"
      style={`--todo-filter-duration: ${motionDuration}ms`}
    >
    <div class="todo-sections">
      <section class="todo-section" aria-labelledby="active-todos-heading">
        <header>
          <strong id="active-todos-heading">Yapılacaklar</strong>
          <span class="todo-section__divider" aria-hidden="true"></span>
          <span class="todo-section__count">{active.length}</span>
        </header>
        <TodoRows
          todos={active}
          {tags}
          onChange={(updated, nextTags) => updateSubset(active, updated, nextTags)}
          emptyText={normalizedQuery
            ? 'Aramana uygun açık görev yok.'
            : selectedTagId ? 'Bu etikette açık görev yok.' : 'Açık görev yok.'}
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
            {tags}
            onChange={(updated, nextTags) => updateSubset(completed, updated, nextTags)}
            emptyText={normalizedQuery
              ? 'Aramana uygun tamamlanan görev yok.'
              : selectedTagId ? 'Bu etikette tamamlanan görev yok.' : 'Henüz tamamlanan görev yok.'}
          />
        {/if}
      </section>
    </div>
    </div>
    {/key}
    {/if}
  </div>
</Dialog>

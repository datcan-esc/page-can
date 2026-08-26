<script lang="ts">
  import { onMount } from 'svelte';
  import { resolveTodoTags } from '../../lib/todos';
  import type { Todo, TodoTag } from '../../lib/types';
  import { TODO_CARD_LIMIT } from '../../lib/display-limits';
  import { createId } from '../../lib/utils';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import TodoComposer from './TodoComposer.svelte';
  import TodoFilters from './TodoFilters.svelte';
  import TodoRows from './TodoRows.svelte';
  import './todos.css';

  export let todos: Todo[];
  export let tags: TodoTag[];
  export let selectedTagId = '';
  export let shortcut = '';
  export let showShortcutHints = false;
  export let focusRequest = 0;
  export let onChange: (todos: Todo[], tags?: TodoTag[]) => void;
  export let onFilterChange: (tagId: string) => void;
  export let onShowAll: () => void;

  let filterDirection = 1;
  let motionDuration = 170;

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) motionDuration = 0;
  });

  $: activeTodos = todos
    .filter((todo) => !todo.completed)
    .filter((todo) => !selectedTagId || todo.tagIds.includes(selectedTagId))
    .sort((left, right) => right.createdAt - left.createdAt);
  $: visible = activeTodos.slice(0, TODO_CARD_LIMIT);
  $: selectedTag = tags.find((tag) => tag.id === selectedTagId);

  function addTodo(title: string, tagNames: string[]) {
    const resolved = resolveTodoTags(
      selectedTag && !tagNames.some((name) =>
        name.toLocaleLowerCase('tr-TR') === selectedTag.name.toLocaleLowerCase('tr-TR'))
        ? [selectedTag.name, ...tagNames]
        : tagNames,
      tags,
    );
    onChange([
      ...todos,
      {
        id: createId('todo'),
        title,
        tagIds: resolved.tagIds,
        completed: false,
        createdAt: Date.now(),
      },
    ], resolved.tags);
  }

  function selectFilter(tagId: string, direction: number) {
    filterDirection = direction;
    onFilterChange(tagId);
  }

  function updateVisible(updated: Todo[], nextTags = tags) {
    const visibleIds = new Set(visible.map((todo) => todo.id));
    onChange([
      ...todos.filter((todo) => !visibleIds.has(todo.id)),
      ...updated,
    ], nextTags);
  }
</script>

<Card title="Yapılacaklar" headingId="todo-heading" class="todo-card">
  <svelte:fragment slot="action">
    <Button variant="ghost" size="sm" onclick={onShowAll}>Detaylar</Button>
  </svelte:fragment>

  <TodoComposer
    onAdd={addTodo}
    {tags}
    placeholder={selectedTag ? `#${selectedTag.name} için görev ekle` : 'Görev ekle · # ile etiketle'}
    {shortcut}
    {showShortcutHints}
    {focusRequest}
  />
  <TodoFilters {tags} {selectedTagId} onSelect={selectFilter} />
  {#key selectedTagId}
    <div
      class:todo-filter-page--backward={filterDirection < 0}
      class="todo-filter-page"
      style={`--todo-filter-duration: ${motionDuration}ms`}
    >
      <TodoRows
        todos={visible}
        {tags}
        onChange={updateVisible}
        emptyText={selectedTagId ? 'Bu etikette açık görev yok.' : 'Bugün için açık görev yok.'}
        limitNote={activeTodos.length >= TODO_CARD_LIMIT
          ? `${TODO_CARD_LIMIT} açık görev gösteriliyor. Daha fazlası için`
          : ''}
        onLimitClick={onShowAll}
      />
    </div>
  {/key}
</Card>

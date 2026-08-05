<script lang="ts">
  import type { Todo } from '../lib/types';
  import Icon from './Icon.svelte';
  import BaseDialog from './BaseDialog.svelte';
  import TodoRows from './TodoRows.svelte';

  export let todos: Todo[];
  export let onClose: () => void;
  export let onChange: (todos: Todo[]) => void;

  let tab: 'active' | 'completed' = 'active';
  let query = '';

  $: normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  $: filtered = todos
    .filter((todo) => tab === 'completed' ? todo.completed : !todo.completed)
    .filter((todo) => todo.title.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
    .sort((left, right) => tab === 'completed'
      ? (right.completedAt ?? 0) - (left.completedAt ?? 0)
      : right.createdAt - left.createdAt);

  function updateFiltered(updated: Todo[]) {
    const visibleIds = new Set(filtered.map((todo) => todo.id));
    onChange([
      ...todos.filter((todo) => !visibleIds.has(todo.id)),
      ...updated,
    ]);
  }
</script>

<BaseDialog title="Tüm yapılacaklar" subtitle={`${todos.length} kayıt`} {onClose} wide>
  <div class="modal-toolbar">
    <div class="segmented-control">
      <button class:active={tab === 'active'} type="button" onclick={() => (tab = 'active')}>Yapılacaklar</button>
      <button class:active={tab === 'completed'} type="button" onclick={() => (tab = 'completed')}>Tamamlananlar</button>
    </div>
    <div class="search-field compact-search">
      <Icon name="search" size={17} />
      <input bind:value={query} placeholder="Ara" aria-label="Yapılacaklarda ara" />
    </div>
  </div>

  <div class="expanded-todos">
    <TodoRows todos={filtered} onChange={updateFiltered} />
  </div>
</BaseDialog>

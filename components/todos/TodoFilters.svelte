<script lang="ts">
  import type { TodoTag } from '../../lib/types';
  import Badge from '../ui/Badge.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import './todos.css';

  export let tags: TodoTag[];
  export let selectedTagId = '';
  export let onSelect: (tagId: string, direction: number) => void;
  export let onManage: (() => void) | undefined = undefined;
  export let managing = false;
  export let manageDisabled = false;

  $: options = [{ id: '', name: 'Tümü', color: '' }, ...tags];

  function choose(tagId: string, target?: HTMLElement) {
    const currentIndex = options.findIndex((option) => option.id === selectedTagId);
    const nextIndex = options.findIndex((option) => option.id === tagId);
    onSelect(tagId, nextIndex >= currentIndex ? 1 : -1);
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...(event.currentTarget as HTMLElement)
      .parentElement!
      .querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const currentIndex = tabs.indexOf(event.currentTarget as HTMLButtonElement);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1);
    if (event.key === 'ArrowRight') nextIndex = Math.min(tabs.length - 1, currentIndex + 1);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    const next = tabs[nextIndex];
    next?.focus();
    next?.click();
  }
</script>

<div class="todo-filter-bar">
  <div class="todo-filter-tabs" role="tablist" aria-label="Yapılacakları etikete göre filtrele">
    {#each options as option (option.id || 'all')}
      <button
        type="button"
        class:active={selectedTagId === option.id}
        class="todo-filter-tab"
        role="tab"
        aria-selected={selectedTagId === option.id}
        tabindex={selectedTagId === option.id ? 0 : -1}
        onclick={(event) => choose(option.id, event.currentTarget)}
        onkeydown={handleKeydown}
      >
        {#if option.id}
          <Badge
            color={option.color}
            variant={selectedTagId === option.id ? 'outline' : 'soft'}
          >#{option.name}</Badge>
        {:else}
          <span>Tümü</span>
        {/if}
      </button>
    {/each}
  </div>
  {#if onManage}
    <IconButton
      label={managing ? 'Görevlere dön' : 'Etiketleri yönet'}
      variant="ghost"
      class={managing ? 'todo-tag-manage active' : 'todo-tag-manage'}
      disabled={manageDisabled}
      aria-pressed={managing}
      onclick={onManage}
    >
      <Icon name={managing ? 'list' : 'sliders'} size={15} />
    </IconButton>
  {/if}
</div>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { Todo, TodoTag } from '../../lib/types';
  import Badge from '../ui/Badge.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import './todos.css';

  export let tags: TodoTag[];
  export let todos: Todo[] = [];
  export let selectedTagId = '';
  export let onSelect: (tagId: string, direction: number) => void;
  export let onManage: (() => void) | undefined = undefined;
  export let managing = false;
  export let manageDisabled = false;
  export let showShortcutHint = false;

  let shortcutModifierLabel = 'Alt';
  let shortcutModifierName = 'Alt';

  onMount(() => {
    const platform = `${navigator.platform} ${navigator.userAgent}`;
    if (/Mac|iPhone|iPad|iPod/i.test(platform)) {
      shortcutModifierLabel = '⌥';
      shortcutModifierName = 'Option';
    }
  });

  $: options = [
    { id: '', name: 'Tümü', color: 'var(--primary)', count: todos.length },
    ...tags.map((tag) => ({
      ...tag,
      count: todos.filter((todo) => todo.tagIds.includes(tag.id)).length,
    })),
  ];

  function choose(tagId: string, target?: HTMLElement, explicitDirection?: number) {
    const currentIndex = options.findIndex((option) => option.id === selectedTagId);
    const nextIndex = options.findIndex((option) => option.id === tagId);
    const direction = explicitDirection ?? (nextIndex >= currentIndex ? 1 : -1);
    onSelect(tagId, direction);
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || options.length <= 1) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const tabs = [...(event.currentTarget as HTMLElement)
      .parentElement!
      .querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const currentIndex = tabs.indexOf(event.currentTarget as HTMLButtonElement);
    let nextIndex = currentIndex;
    let direction = 1;
    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      direction = -1;
    }
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
      direction = 1;
    }
    if (event.key === 'Home') {
      nextIndex = 0;
      direction = -1;
    }
    if (event.key === 'End') {
      nextIndex = tabs.length - 1;
      direction = 1;
    }
    const next = tabs[nextIndex];
    next?.focus();
    const nextOption = options[nextIndex];
    if (next && nextOption) choose(nextOption.id, next, direction);
  }
</script>

<div class="todo-filter-bar">
  <div
    class="todo-filter-tabs"
    role="tablist"
    aria-label="Yapılacakları etikete göre filtrele"
    aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
    title={`Etiketler arasında ${shortcutModifierName} + Sol/Sağ ok ile geçiş yapın`}
  >
    {#each options as option (option.id || 'all')}
      <button
        type="button"
        class:active={selectedTagId === option.id}
        class="todo-filter-tab"
        role="tab"
        aria-selected={selectedTagId === option.id}
        aria-label={`${option.name}, ${option.count} görev`}
        tabindex={selectedTagId === option.id ? 0 : -1}
        onclick={(event) => choose(option.id, event.currentTarget)}
        onkeydown={handleKeydown}
      >
        <Badge
          color={option.color}
          variant={selectedTagId === option.id ? 'outline' : 'soft'}
          class="todo-filter-chip"
        >
          <span class="todo-filter-tab__label">{option.id ? `#${option.name}` : option.name}</span>
          {#if selectedTagId === option.id}
            <span class="todo-filter-tab__count" aria-hidden="true">{option.count}</span>
          {/if}
        </Badge>
      </button>
    {/each}
  </div>
  {#if showShortcutHint}
    <span
      class="todo-filter-shortcut"
      aria-label={`Etiketler arasında ${shortcutModifierName} ve yön tuşlarıyla geçiş yapabilirsiniz`}
      title={`Önceki veya sonraki etiket: ${shortcutModifierName} + Sol/Sağ ok`}
    ><kbd>{shortcutModifierLabel}</kbd><span aria-hidden="true">↔</span></span>
  {/if}
  {#if onManage}
    <IconButton
      label={managing ? 'Görevlere dön' : 'Etiketleri yönet'}
      title={manageDisabled
        ? 'Etiket yönetimi tamamlanan görevler yüklendiğinde kullanılabilir'
        : managing ? 'Görevlere dön' : 'Etiketleri yönet'}
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

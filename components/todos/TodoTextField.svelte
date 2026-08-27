<script lang="ts">
  import { tick } from 'svelte';
  import {
    TODO_DRAFT_MAX_LENGTH,
    TODO_TEXT_MAX_LENGTH,
    isValidTodoTagName,
    normalizeTodoTagName,
    normalizeTodoText,
    todoTagColor,
    todoTagKey,
    todoTagTriggerAt,
  } from '../../lib/todos';
  import type { TodoTag } from '../../lib/types';
  import { createId } from '../../lib/utils';
  import Chip from '../ui/Chip.svelte';
  import Input from '../ui/Input.svelte';
  import './todo-text-field.css';

  export let value = '';
  export let placeholder = '';
  export let ariaLabel: string;
  export let instruction = '';
  export let onCommit: (value: string) => void;
  export let onCancel: (() => void) | undefined = undefined;
  export let commitOnBlur = false;
  export let trailing = false;
  export let tags: TodoTag[] = [];
  export let enableTagSuggestions = false;

  let field: Input;
  let className = '';
  const suggestionsId = createId('todo-tag-suggestions');
  let trigger = todoTagTriggerAt('', 0);
  let selectedSuggestion = 0;
  let suggestionsSuppressed = false;
  export { className as class };

  $: normalizedQuery = trigger ? todoTagKey(trigger.query) : '';
  $: matchingTags = trigger
    ? tags
      .filter((tag) => todoTagKey(tag.name).includes(normalizedQuery))
      .sort((left, right) => {
        const leftStarts = todoTagKey(left.name).startsWith(normalizedQuery) ? 0 : 1;
        const rightStarts = todoTagKey(right.name).startsWith(normalizedQuery) ? 0 : 1;
        return leftStarts - rightStarts
          || left.name.localeCompare(right.name, 'tr-TR', { sensitivity: 'base' });
      })
      .slice(0, 6)
    : [];
  $: createName = trigger && isValidTodoTagName(trigger.query)
    && !tags.some((tag) => todoTagKey(tag.name) === normalizedQuery)
      ? normalizeTodoTagName(trigger.query)
      : '';
  $: suggestionCount = matchingTags.length + (createName ? 1 : 0);
  $: suggestionsOpen = enableTagSuggestions
    && Boolean(trigger)
    && !suggestionsSuppressed;
  $: suggestionsVisible = suggestionsOpen && suggestionCount > 0;
  $: if (selectedSuggestion >= suggestionCount) selectedSuggestion = Math.max(0, suggestionCount - 1);

  export function focus() {
    field?.focus();
  }

  export function focusAtEnd() {
    field?.focus();
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLTextAreaElement) {
      activeElement.setSelectionRange(value.length, value.length);
    }
  }

  export function commit() {
    trigger = null;
    onCommit(enableTagSuggestions ? value : normalizeTodoText(value));
  }

  function refreshTrigger(target: HTMLTextAreaElement, resetSuppression = true) {
    if (resetSuppression) suggestionsSuppressed = false;
    trigger = enableTagSuggestions
      ? todoTagTriggerAt(target.value, target.selectionStart ?? target.value.length)
      : null;
    selectedSuggestion = 0;
  }

  function handleInput(event: Event) {
    refreshTrigger(event.currentTarget as HTMLTextAreaElement);
  }

  function handleCaretChange(event: Event) {
    refreshTrigger(event.currentTarget as HTMLTextAreaElement, false);
  }

  async function scrollActiveSuggestion() {
    await tick();
    document.getElementById(`${suggestionsId}-${selectedSuggestion}`)
      ?.scrollIntoView({ block: 'nearest' });
  }

  async function selectSuggestion(index = selectedSuggestion) {
    if (!trigger) return;
    const existing = matchingTags[index];
    const name = existing?.name ?? (index === matchingTags.length ? createName : '');
    if (!name) return;
    const insertion = `#${name} `;
    const nextValue = `${value.slice(0, trigger.start)}${insertion}${value.slice(trigger.end)}`
      .slice(0, enableTagSuggestions ? TODO_DRAFT_MAX_LENGTH : TODO_TEXT_MAX_LENGTH);
    const caret = Math.min(trigger.start + insertion.length, nextValue.length);
    value = nextValue;
    trigger = null;
    suggestionsSuppressed = false;
    await tick();
    field?.focus();
    field?.setSelectionRange(caret);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.isComposing) return;

    if (
      suggestionsOpen
      && suggestionCount > 0
      && (event.key === 'ArrowDown' || event.key === 'ArrowUp')
    ) {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      selectedSuggestion = (selectedSuggestion + offset + suggestionCount) % suggestionCount;
      void scrollActiveSuggestion();
      return;
    }

    if (
      suggestionsOpen
      && suggestionCount > 0
      && (event.key === 'Enter' || event.key === 'Tab')
    ) {
      event.preventDefault();
      void selectSuggestion();
      return;
    }

    if (trigger && event.key === 'Enter' && !suggestionCount) {
      event.preventDefault();
      return;
    }

    if (trigger && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      suggestionsSuppressed = true;
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commit();
      return;
    }

    if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  }

  function handleBlur() {
    trigger = null;
    if (commitOnBlur) commit();
  }
</script>

<Input
  bind:this={field}
  bind:value
  multiline
  rows={1}
  maxLength={enableTagSuggestions ? TODO_DRAFT_MAX_LENGTH : TODO_TEXT_MAX_LENGTH}
  {placeholder}
  class={`todo-text-field ${className}`.trim()}
  aria-label={ariaLabel}
  aria-description={instruction || undefined}
  title={instruction || undefined}
  aria-expanded={suggestionsVisible}
  aria-controls={suggestionsVisible ? suggestionsId : undefined}
  aria-activedescendant={suggestionsVisible
    ? `${suggestionsId}-${selectedSuggestion}`
    : undefined}
  aria-autocomplete={enableTagSuggestions ? 'list' : undefined}
  aria-haspopup={enableTagSuggestions ? 'listbox' : undefined}
  onkeydown={handleKeydown}
  onInput={handleInput}
  onfocus={handleCaretChange}
  onclick={handleCaretChange}
  onblur={handleBlur}
>
  <svelte:fragment slot="trailing">
    {#if trailing}<slot name="trailing" />{/if}
  </svelte:fragment>
  {#if suggestionsVisible}
    <div
      id={suggestionsId}
      class="todo-tag-suggestions"
      role="listbox"
      aria-label="Etiket önerileri"
    >
      {#each matchingTags as tag, index (tag.id)}
        <Chip
          id={`${suggestionsId}-${index}`}
          selected={selectedSuggestion === index}
          color={tag.color}
          class="todo-tag-suggestion"
          role="option"
          aria-label={`#${tag.name}`}
          aria-selected={selectedSuggestion === index}
          onmousedown={(event: MouseEvent) => event.preventDefault()}
          onmouseenter={() => (selectedSuggestion = index)}
          onclick={() => void selectSuggestion(index)}
        >#{tag.name}</Chip>
      {/each}
      {#if createName}
        <Chip
          id={`${suggestionsId}-${matchingTags.length}`}
          selected={selectedSuggestion === matchingTags.length}
          color={todoTagColor(createName)}
          class="todo-tag-suggestion"
          role="option"
          aria-label={`#${createName} etiketini oluştur`}
          aria-selected={selectedSuggestion === matchingTags.length}
          onmousedown={(event: MouseEvent) => event.preventDefault()}
          onmouseenter={() => (selectedSuggestion = matchingTags.length)}
          onclick={() => void selectSuggestion(matchingTags.length)}
        >#{createName}</Chip>
      {/if}
    </div>
  {/if}
</Input>

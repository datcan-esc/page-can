<script lang="ts">
  import { TODO_TEXT_MAX_LENGTH, normalizeTodoText } from '../../lib/todos';
  import Input from '../ui/Input.svelte';
  import './todos.css';

  export let value = '';
  export let placeholder = '';
  export let ariaLabel: string;
  export let instruction = '';
  export let onCommit: (value: string) => void;
  export let onCancel: (() => void) | undefined = undefined;
  export let commitOnBlur = false;
  export let trailing = false;

  let field: Input;
  let className = '';
  export { className as class };

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
    onCommit(normalizeTodoText(value));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.isComposing) return;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commit();
      return;
    }

    if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      onCancel();
    }
  }

  function handleBlur() {
    if (commitOnBlur) commit();
  }
</script>

<Input
  bind:this={field}
  bind:value
  multiline
  rows={1}
  maxLength={TODO_TEXT_MAX_LENGTH}
  {placeholder}
  class={`todo-text-field ${className}`.trim()}
  aria-label={ariaLabel}
  aria-description={instruction || undefined}
  title={instruction || undefined}
  onkeydown={handleKeydown}
  onblur={handleBlur}
>
  <svelte:fragment slot="trailing">
    {#if trailing}<slot name="trailing" />{/if}
  </svelte:fragment>
</Input>

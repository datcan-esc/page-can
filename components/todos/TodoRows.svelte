<script lang="ts">
  import { flip } from 'svelte/animate';
  import { onMount, tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import { parseTodoDraft, resolveTodoTags, todoDraftText } from '../../lib/todos';
  import type { Todo, TodoTag } from '../../lib/types';
  import Badge from '../ui/Badge.svelte';
  import Button from '../ui/Button.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import List from '../ui/List.svelte';
  import ListItem from '../ui/ListItem.svelte';
  import ListLimitNote from '../ui/ListLimitNote.svelte';
  import TodoTextField from './TodoTextField.svelte';
  import './todos.css';

  export let todos: Todo[];
  export let tags: TodoTag[] = [];
  export let onChange: (todos: Todo[], tags?: TodoTag[]) => void;
  export let emptyText = 'Bu listede görev yok.';
  export let limitNote = '';
  export let onLimitClick: (() => void) | undefined = undefined;

  let editingId = '';
  let editingTitle = '';
  let expandedId = '';
  let editingInput: TodoTextField | undefined;
  let motionDuration = 170;

  $: tagsById = new Map(tags.map((tag) => [tag.id, tag]));

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) motionDuration = 0;
  });

  function toggle(todo: Todo) {
    const pending = editingId === todo.id ? parseTodoDraft(editingTitle) : null;
    const resolved = pending?.title ? resolveTodoTags(pending.tagNames, tags) : null;
    onChange(todos.map((item) => {
      if (item.id !== todo.id) return item;
      const completed = !item.completed;
      return {
        ...item,
        ...(pending?.title ? { title: pending.title, tagIds: resolved?.tagIds ?? item.tagIds } : {}),
        completed,
        completedAt: completed ? Date.now() : undefined,
      };
    }), resolved?.tags);
    if (editingId === todo.id) cancelEdit();
  }

  function toggleExpanded(todo: Todo) {
    expandedId = expandedId === todo.id ? '' : todo.id;
  }

  async function beginEdit(todo: Todo) {
    expandedId = '';
    editingId = todo.id;
    editingTitle = todoDraftText(todo, tags);
    await tick();
    editingInput?.focusAtEnd();
  }

  function finishEdit(value = editingTitle) {
    if (!editingId) return;
    const draft = parseTodoDraft(value);
    if (draft.title) {
      const resolved = resolveTodoTags(draft.tagNames, tags);
      onChange(
        todos.map((item) => item.id === editingId
          ? { ...item, title: draft.title, tagIds: resolved.tagIds }
          : item),
        resolved.tags,
      );
    }
    editingId = '';
    editingTitle = '';
    expandedId = '';
  }

  function cancelEdit() {
    editingId = '';
    editingTitle = '';
    expandedId = '';
  }

  function remove(id: string) {
    if (editingId === id) cancelEdit();
    onChange(todos.filter((item) => item.id !== id));
  }

  function handleEditAction(todo: Todo) {
    if (editingId === todo.id) {
      finishEdit();
      return;
    }
    void beginEdit(todo);
  }
</script>

<List class="todo-rows">
  {#each todos as todo, index (todo.id)}
    <div
      class="todo-motion"
      class:todo-motion--editing={editingId === todo.id}
      animate:flip={{ duration: motionDuration }}
      out:slide={{ duration: motionDuration, axis: 'y' }}
    >
      <ListItem
        divider={index < todos.length - 1}
        expanded={editingId === todo.id || expandedId === todo.id}
        muted={todo.completed}
        class={`todo-row${todo.completed ? ' completed' : ''}${editingId === todo.id ? ' editing' : ''}`}
      >
        <svelte:fragment slot="leading">
          <Button
            variant="ghost"
            class="todo-check"
            aria-label={todo.completed ? 'Yapılacaklara geri taşı' : 'Tamamlandı olarak işaretle'}
            onmousedown={(event: MouseEvent) => {
              if (editingId === todo.id) event.preventDefault();
            }}
            onclick={() => toggle(todo)}
          >
            {#if todo.completed}<Icon name="check" size={13} strokeWidth={2.5} />{/if}
          </Button>
        </svelte:fragment>

        {#if editingId === todo.id}
          <TodoTextField
            bind:this={editingInput}
            bind:value={editingTitle}
            class={`todo-edit-field${index < 2 ? ' todo-edit-field--below' : ''}`}
            ariaLabel="Yapılacak metnini düzenle"
            instruction="Enter ile kaydet. Shift+Enter ile yeni satır ekle. Escape ile vazgeç."
            onCommit={finishEdit}
            onCancel={cancelEdit}
            commitOnBlur
            {tags}
            enableTagSuggestions
          />
        {:else}
          {@const todoTags = todo.tagIds.flatMap((tagId) => {
            const tag = tagsById.get(tagId);
            return tag ? [tag] : [];
          })}
          <Button
            variant="ghost"
            class="todo-title"
            aria-expanded={expandedId === todo.id}
            title={expandedId === todo.id ? 'Metni daralt' : 'Metnin tamamını göster'}
            onclick={() => toggleExpanded(todo)}
          >
            <span class="todo-title__content">
              {#each (expandedId === todo.id ? todoTags : todoTags.slice(0, 2)) as tag (tag.id)}
                <Badge color={tag.color}>#{tag.name}</Badge>
              {/each}
              {#if expandedId !== todo.id && todoTags.length > 2}
                <Badge color="var(--muted)" variant="outline">+{todoTags.length - 2}</Badge>
              {/if}
              <span class="todo-title__text">{todo.title}</span>
            </span>
          </Button>
        {/if}

        <svelte:fragment slot="actions">
          <IconButton
            variant="ghost"
            label={editingId === todo.id ? 'Kaydet' : 'Düzenle'}
            onmousedown={(event: MouseEvent) => {
              if (editingId === todo.id) event.preventDefault();
            }}
            onclick={() => handleEditAction(todo)}
          >
            <Icon name={editingId === todo.id ? 'check' : 'edit'} size={14} strokeWidth={editingId === todo.id ? 2.4 : 1.8} />
          </IconButton>
          <IconButton
            variant="ghost"
            label="Sil"
            onmousedown={(event: MouseEvent) => {
              if (editingId === todo.id) event.preventDefault();
            }}
            onclick={() => remove(todo.id)}
          >
            <Icon name="close" size={14} />
          </IconButton>
        </svelte:fragment>
      </ListItem>
    </div>
  {:else}
    <div class="card-empty todo-empty">
      <Icon name="check" size={20} />
      <p>{emptyText}</p>
    </div>
  {/each}
  {#if limitNote && onLimitClick}
    <ListLimitNote text={limitNote} onShowAll={onLimitClick} />
  {/if}
</List>

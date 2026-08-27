<script lang="ts">
  import { tick } from 'svelte';
  import {
    isValidTodoTagName,
    normalizeTodoTagName,
    todoTagColor,
    todoTagKey,
  } from '../../lib/todos';
  import type { Todo, TodoTag } from '../../lib/types';
  import Badge from '../ui/Badge.svelte';
  import Button from '../ui/Button.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Input from '../ui/Input.svelte';
  import List from '../ui/List.svelte';
  import ListItem from '../ui/ListItem.svelte';
  import './todo-tag-manager.css';

  export let tags: TodoTag[];
  export let todos: Todo[];
  export let onChange: (todos: Todo[], tags: TodoTag[]) => void;

  let editingId = '';
  let editingName = '';
  let deletingId = '';
  let error = '';
  let renameInput: Input | undefined;

  function usageCount(tagId: string): number {
    return todos.filter((todo) => todo.tagIds.includes(tagId)).length;
  }

  async function beginRename(tag: TodoTag) {
    deletingId = '';
    editingId = tag.id;
    editingName = tag.name;
    error = '';
    await tick();
    renameInput?.focus();
    renameInput?.select();
  }

  function cancelRename() {
    editingId = '';
    editingName = '';
    error = '';
  }

  function saveRename(tag: TodoTag) {
    const name = normalizeTodoTagName(editingName);
    if (!isValidTodoTagName(name)) {
      error = 'Harf, sayı, tire veya alt çizgi kullanın.';
      return;
    }
    if (tags.some((candidate) =>
      candidate.id !== tag.id && todoTagKey(candidate.name) === todoTagKey(name))) {
      error = 'Bu isimde bir etiket zaten var.';
      return;
    }
    onChange(todos, tags.map((candidate) => candidate.id === tag.id
      ? { ...candidate, name, color: todoTagColor(name) }
      : candidate));
    cancelRename();
  }

  function removeTag(tagId: string) {
    onChange(
      todos.map((todo) => ({
        ...todo,
        tagIds: todo.tagIds.filter((id) => id !== tagId),
      })),
      tags.filter((tag) => tag.id !== tagId),
    );
    deletingId = '';
    if (editingId === tagId) cancelRename();
  }
</script>

<section class="todo-tag-manager" aria-labelledby="todo-tag-manager-heading">
  <header>
    <div>
      <strong id="todo-tag-manager-heading">Etiketleri yönet</strong>
      <span>{tags.length} etiket</span>
    </div>
    <p>Etiketi silmek görevleri değil, yalnızca etiket bağlantısını kaldırır.</p>
  </header>

  {#if tags.length}
    <List class="todo-tag-manager__list">
      {#each tags as tag, index (tag.id)}
        <ListItem
          divider={index < tags.length - 1}
          expanded={editingId === tag.id}
          actionsVisible={deletingId === tag.id}
          class="todo-tag-manager__row"
        >
          <div class="todo-tag-manager__content">
            <Badge color={tag.color} size="md">#{tag.name}</Badge>
            {#if editingId === tag.id}
              <form class="todo-tag-rename" onsubmit={(event) => { event.preventDefault(); saveRename(tag); }}>
                <Input
                  bind:this={renameInput}
                  bind:value={editingName}
                  class="todo-tag-rename__input"
                  maxLength={32}
                  aria-label={`${tag.name} etiketinin yeni adı`}
                  aria-invalid={Boolean(error)}
                  onkeydown={(event: KeyboardEvent) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      event.stopPropagation();
                      cancelRename();
                    }
                  }}
                />
                <IconButton label="Yeniden adlandırmayı kaydet" variant="ghost" tone="primary" type="submit">
                  <Icon name="check" size={15} />
                </IconButton>
                <IconButton label="Vazgeç" variant="ghost" onclick={cancelRename}>
                  <Icon name="close" size={15} />
                </IconButton>
              </form>
              {#if error}<p class="todo-tag-manager__error" role="alert">{error}</p>{/if}
            {:else}
              <span class="todo-tag-manager__count">{usageCount(tag.id)} görevde</span>
            {/if}
          </div>

          <svelte:fragment slot="actions">
            {#if editingId !== tag.id}
              {#if deletingId === tag.id}
                <div class="todo-tag-delete-confirm">
                  <span>Kaldırılsın mı?</span>
                  <Button variant="ghost" size="sm" onclick={() => (deletingId = '')}>Vazgeç</Button>
                  <Button variant="ghost" tone="danger" size="sm" onclick={() => removeTag(tag.id)}>Sil</Button>
                </div>
              {:else}
                <div class="todo-tag-manager__actions">
                  <IconButton label={`${tag.name} etiketini yeniden adlandır`} variant="ghost" onclick={() => void beginRename(tag)}>
                    <Icon name="edit" size={15} />
                  </IconButton>
                  <IconButton label={`${tag.name} etiketini sil`} variant="ghost" tone="danger" onclick={() => { editingId = ''; deletingId = tag.id; }}>
                    <Icon name="trash" size={15} />
                  </IconButton>
                </div>
              {/if}
            {/if}
          </svelte:fragment>
        </ListItem>
      {/each}
    </List>
  {:else}
    <EmptyState text="Henüz kalıcı bir etiket yok." />
  {/if}
</section>

<script lang="ts">
  import type { BookmarkItem } from '../../lib/types';
  import { BOOKMARK_DIALOG_BATCH_SIZE } from '../../lib/display-limits';
  import Button from '../ui/Button.svelte';
  import Dialog from '../ui/Dialog.svelte';
  import Input from '../ui/Input.svelte';
  import List from '../ui/List.svelte';
  import BookmarkRow from './BookmarkRow.svelte';
  import '../ui/form.css';
  import './bookmarks.css';

  export let bookmarks: BookmarkItem[];
  export let loading = false;
  export let onClose: () => void;
  export let onRemove: (bookmark: BookmarkItem) => void;

  let query = '';
  let visibleCount = BOOKMARK_DIALOG_BATCH_SIZE;

  $: normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  $: filtered = bookmarks.filter((bookmark) => {
    if (!normalizedQuery) return true;
    return `${bookmark.title} ${bookmark.url} ${bookmark.path}`
      .toLocaleLowerCase('tr-TR')
      .includes(normalizedQuery);
  });
  $: visible = filtered.slice(0, visibleCount);
</script>

<Dialog
  title="Tüm yer imleri"
  subtitle={`${bookmarks.length}`}
  {onClose}
  wide
>
  <Input
    bind:value={query}
    type="search"
    icon="search"
    class="bookmark-search"
    placeholder="İsim, adres veya klasör ara"
    aria-label="Yer imlerinde ara"
    disabled={loading}
    onInput={() => (visibleCount = BOOKMARK_DIALOG_BATCH_SIZE)}
  />

  {#if loading}
    <div class="modal-empty" role="status">Yer imleri yükleniyor…</div>
  {:else}
    <List class="expanded-list">
      {#each visible as bookmark, index (bookmark.id)}
        <BookmarkRow {bookmark} {onRemove} divider={index < visible.length - 1} />
      {:else}
        <div class="modal-empty">Aramana uygun bir yer imi bulunamadı.</div>
      {/each}
    </List>
  {/if}

  {#if !loading && visibleCount < filtered.length}
    <Button variant="outlined" class="load-more-button" onclick={() => (visibleCount += BOOKMARK_DIALOG_BATCH_SIZE)}>
      {BOOKMARK_DIALOG_BATCH_SIZE} kayıt daha göster · {visibleCount}/{filtered.length}
    </Button>
  {/if}
</Dialog>

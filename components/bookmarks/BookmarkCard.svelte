<script lang="ts">
  import type { BookmarkItem } from '../../lib/types';
  import Card from '../ui/Card.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import List from '../ui/List.svelte';
  import BookmarkRow from './BookmarkRow.svelte';
  import './bookmarks.css';

  export let bookmarks: BookmarkItem[] = [];
  export let onShowAll: () => void;
  export let onRemove: (bookmark: BookmarkItem) => void;
</script>

<Card
  title="Yer imleri"
  headingId="bookmarks-heading"
  class={bookmarks.length === 0 ? 'bookmarks-card is-empty' : 'bookmarks-card'}
>
  <svelte:fragment slot="action">
    {#if bookmarks.length}
      <IconButton variant="ghost" label="Tüm yer imlerini aç" title="Tüm yer imleri" onclick={onShowAll}>
        <Icon name="arrow" size={16} />
      </IconButton>
    {/if}
  </svelte:fragment>

  <List class="bookmark-list">
    {#each bookmarks as bookmark (bookmark.id)}
      <BookmarkRow {bookmark} {onRemove} />
    {:else}
      <div class="bookmark-empty">
        <span class="bookmark-empty__icon"><Icon name="bookmark" size={21} /></span>
        <span>
          <strong>Henüz yer imi yok</strong>
          <small>Kaydettiğin sayfalar burada görünür.</small>
        </span>
      </div>
    {/each}
  </List>
</Card>

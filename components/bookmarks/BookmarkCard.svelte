<script lang="ts">
  import type { BookmarkItem } from '../../lib/types';
  import { hostname } from '../../lib/utils';
  import Card from '../ui/Card.svelte';
  import Favicon from '../ui/Favicon.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import List from '../ui/List.svelte';
  import ListItem from '../ui/ListItem.svelte';
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
      <ListItem class="bookmark-row">
        <a class="bookmark-link" href={bookmark.url} aria-label={`${bookmark.title} sayfasını aç`}>
          <span class="bookmark-favicon">
            <Favicon url={bookmark.url} requestSize={32} iconSize={15} />
          </span>
          <span class="bookmark-copy">
            <strong>{bookmark.title}</strong>
            <span class="bookmark-url">{hostname(bookmark.url)}</span>
          </span>
          <span class="bookmark-open"><Icon name="external" size={14} /></span>
        </a>
        <svelte:fragment slot="actions">
          <IconButton variant="ghost" label={`${bookmark.title} yer imini sil`} class="bookmark-remove" onclick={() => onRemove(bookmark)}>
            <Icon name="close" size={14} />
          </IconButton>
        </svelte:fragment>
      </ListItem>
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

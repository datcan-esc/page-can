<script lang="ts">
  import type { BookmarkItem } from '../lib/types';
  import { faviconUrl } from '../lib/utils';
  import BaseCard from './BaseCard.svelte';
  import Icon from './Icon.svelte';

  export let bookmarks: BookmarkItem[] = [];
  export let onShowAll: () => void;
  export let onRemove: (bookmark: BookmarkItem) => void;
</script>

<BaseCard title="Son yer imleri" headingId="bookmarks-heading" class="bookmarks-card">
  <div class="bookmark-list">
    {#each bookmarks as bookmark (bookmark.id)}
      <div class="bookmark-row">
        <a href={bookmark.url} aria-label={`${bookmark.title} sayfasını aç`}>
          <span class="bookmark-favicon">
            <Icon name="bookmark" size={15} />
            <img
              src={faviconUrl(bookmark.url, 32)}
              alt=""
              onerror={(event) => ((event.currentTarget as HTMLImageElement).style.display = 'none')}
            />
          </span>
          <strong>{bookmark.title}</strong>
          <span class="bookmark-url">{bookmark.url}</span>
        </a>
        <button class="bookmark-remove" type="button" aria-label={`${bookmark.title} yer imini sil`} onclick={() => onRemove(bookmark)}>
          <Icon name="close" size={15} />
        </button>
      </div>
    {:else}
      <div class="card-empty"><p>Henüz yer imi yok.</p></div>
    {/each}
  </div>

  <svelte:fragment slot="footer">
    <button class="text-link" type="button" onclick={onShowAll} disabled={!bookmarks.length}>
      Tümünü gör <Icon name="arrow" size={14} />
    </button>
  </svelte:fragment>
</BaseCard>

<script lang="ts">
  import type { BookmarkItem } from '../lib/types';
  import { faviconUrl, hostname } from '../lib/utils';
  import Icon from './Icon.svelte';
  import BaseDialog from './BaseDialog.svelte';

  export let bookmarks: BookmarkItem[];
  export let onClose: () => void;
  export let onRemove: (bookmark: BookmarkItem) => void;

  let query = '';
  let visibleCount = 100;

  $: normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  $: filtered = bookmarks.filter((bookmark) => {
    if (!normalizedQuery) return true;
    return `${bookmark.title} ${bookmark.url} ${bookmark.path}`
      .toLocaleLowerCase('tr-TR')
      .includes(normalizedQuery);
  });
  $: visible = filtered.slice(0, visibleCount);
</script>

<BaseDialog
  title="Tüm yer imleri"
  subtitle={`${bookmarks.length} yer imi`}
  {onClose}
  wide
>
  <div class="search-field">
    <Icon name="search" size={18} />
    <input
      bind:value={query}
      oninput={() => (visibleCount = 100)}
      placeholder="İsim, adres veya klasör ara"
      aria-label="Yer imlerinde ara"
    />
  </div>

  <div class="expanded-list">
    {#each visible as bookmark (bookmark.id)}
      <div class="list-row bookmark-row expanded">
        <a class="expanded-bookmark-link" href={bookmark.url}>
        <span class="row-icon">
          <Icon name="bookmark" size={17} />
          <img
            src={faviconUrl(bookmark.url, 32)}
            alt=""
            onerror={(event) => ((event.currentTarget as HTMLImageElement).style.display = 'none')}
          />
        </span>
        <span class="row-copy">
          <strong>{bookmark.title}</strong>
          <small>{bookmark.path || hostname(bookmark.url)}</small>
        </span>
        <span class="row-domain">{hostname(bookmark.url)}</span>
        <Icon name="external" size={15} />
        </a>
        <button class="icon-button subtle danger" type="button" aria-label={`${bookmark.title} yer imini sil`} onclick={() => onRemove(bookmark)}>
          <Icon name="trash" size={15} />
        </button>
      </div>
    {:else}
      <div class="modal-empty">Aramana uygun bir yer imi bulunamadı.</div>
    {/each}
  </div>

  {#if visibleCount < filtered.length}
    <button class="load-more-button" type="button" onclick={() => (visibleCount += 100)}>
      100 kayıt daha göster · {visibleCount}/{filtered.length}
    </button>
  {/if}
</BaseDialog>

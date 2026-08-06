<script lang="ts">
  import type { BookmarkItem } from '../lib/types';
  import { hostname } from '../lib/utils';
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  import BaseDialog from './BaseDialog.svelte';
  import Favicon from './Favicon.svelte';
  import IconButton from './IconButton.svelte';

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
          <Favicon url={bookmark.url} requestSize={32} iconSize={17} />
        </span>
        <span class="row-copy">
          <strong>{bookmark.title}</strong>
          <small>{bookmark.path || hostname(bookmark.url)}</small>
        </span>
        <span class="row-domain">{hostname(bookmark.url)}</span>
        <Icon name="external" size={15} />
        </a>
        <IconButton label={`${bookmark.title} yer imini sil`} onclick={() => onRemove(bookmark)}>
          <Icon name="close" size={15} />
        </IconButton>
      </div>
    {:else}
      <div class="modal-empty">Aramana uygun bir yer imi bulunamadı.</div>
    {/each}
  </div>

  {#if visibleCount < filtered.length}
    <Button variant="secondary" class="load-more-button" onclick={() => (visibleCount += 100)}>
      100 kayıt daha göster · {visibleCount}/{filtered.length}
    </Button>
  {/if}
</BaseDialog>

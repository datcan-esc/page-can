<script lang="ts">
  import type { BookmarkItem } from '../../lib/types';
  import { hostname } from '../../lib/utils';
  import Button from '../ui/Button.svelte';
  import Dialog from '../ui/Dialog.svelte';
  import Favicon from '../ui/Favicon.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Input from '../ui/Input.svelte';
  import List from '../ui/List.svelte';
  import ListItem from '../ui/ListItem.svelte';
  import '../ui/form.css';
  import './bookmarks.css';

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

<Dialog
  title="Tüm yer imleri"
  subtitle={`${bookmarks.length} yer imi`}
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
    onInput={() => (visibleCount = 100)}
  />

  <List class="expanded-list">
    {#each visible as bookmark (bookmark.id)}
      <ListItem class="bookmark-row expanded-bookmark-row">
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
        <svelte:fragment slot="actions">
          <IconButton variant="ghost" label={`${bookmark.title} yer imini sil`} onclick={() => onRemove(bookmark)}>
            <Icon name="close" size={15} />
          </IconButton>
        </svelte:fragment>
      </ListItem>
    {:else}
      <div class="modal-empty">Aramana uygun bir yer imi bulunamadı.</div>
    {/each}
  </List>

  {#if visibleCount < filtered.length}
    <Button variant="outlined" class="load-more-button" onclick={() => (visibleCount += 100)}>
      100 kayıt daha göster · {visibleCount}/{filtered.length}
    </Button>
  {/if}
</Dialog>

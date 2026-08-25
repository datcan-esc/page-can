<script lang="ts">
  import type { BookmarkItem } from '../../lib/types';
  import { hostname } from '../../lib/utils';
  import Favicon from '../ui/Favicon.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import ListItem from '../ui/ListItem.svelte';
  import './bookmarks.css';

  export let bookmark: BookmarkItem;
  export let onRemove: (bookmark: BookmarkItem) => void;
  export let divider = false;
</script>

<ListItem class="bookmark-row" {divider}>
  <a class="bookmark-link" href={bookmark.url} aria-label={`${bookmark.title} sayfasını aç`}>
    <span class="bookmark-favicon">
      <Favicon url={bookmark.url} requestSize={32} iconSize={16} />
    </span>
    <span class="bookmark-copy">
      <strong>{bookmark.title}</strong>
      <span class="bookmark-url">{hostname(bookmark.url)}</span>
    </span>
    <span class="bookmark-open" aria-hidden="true"><Icon name="external" size={14} /></span>
  </a>

  <svelte:fragment slot="actions">
    <IconButton
      variant="ghost"
      label={`${bookmark.title} yer imini sil`}
      class="bookmark-remove"
      onclick={() => onRemove(bookmark)}
    >
      <Icon name="close" size={14} />
    </IconButton>
  </svelte:fragment>
</ListItem>

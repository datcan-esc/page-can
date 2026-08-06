<script lang="ts">
  import type { Favorite } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  import Favicon from '../ui/Favicon.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import './favorites.css';

  export let favorite: Favorite;
  export let showName = true;
  export let menuOpen = false;
  export let onMenuToggle: (id: string) => void;
  export let onEdit: (favorite: Favorite) => void;
  export let onDelete: (favorite: Favorite) => void;

  function toggleMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onMenuToggle(favorite.id);
  }

  function edit(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onEdit(favorite);
  }

  function remove(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onDelete(favorite);
  }
</script>

<div class="favorite-entry">
  <a class="favorite-item" href={favorite.url} aria-label={`${favorite.name} sitesini aç`}>
    <span class="favorite-tile">
      <Favicon url={favorite.url} requestSize={64} iconSize={20} />
    </span>
    {#if showName}<span class="favorite-name">{favorite.name}</span>{/if}
  </a>

  <IconButton
    label={`${favorite.name} seçenekleri`}
    variant="ghost"
    class={menuOpen ? 'favorite-menu-trigger active' : 'favorite-menu-trigger'}
    aria-expanded={menuOpen}
    aria-haspopup="menu"
    onclick={toggleMenu}
  >
    <Icon name="more" size={15} />
  </IconButton>

  {#if menuOpen}
    <div class="favorite-menu" role="menu" aria-label={`${favorite.name} yönetimi`}>
      <Button variant="ghost" role="menuitem" onclick={edit}>
        <Icon name="edit" size={14} /> Düzenle
      </Button>
      <Button variant="ghost" role="menuitem" onclick={remove}>
        <Icon name="close" size={14} /> Sil
      </Button>
    </div>
  {/if}
</div>

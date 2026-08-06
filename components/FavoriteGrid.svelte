<script lang="ts">
  import type { Favorite } from '../lib/types';
  import Button from './Button.svelte';
  import Favicon from './Favicon.svelte';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';

  export let favorites: Favorite[] = [];
  export let showNames = true;
  export let onAdd: () => void;
  export let onEdit: (favorite: Favorite) => void;
  export let onDelete: (favorite: Favorite) => void;

  let menuId = '';

  $: visibleFavorites = favorites.slice(0, 15);

  function toggleMenu(event: MouseEvent, id: string) {
    event.preventDefault();
    event.stopPropagation();
    menuId = menuId === id ? '' : id;
  }

  function edit(event: MouseEvent, favorite: Favorite) {
    event.preventDefault();
    event.stopPropagation();
    menuId = '';
    onEdit(favorite);
  }

  function remove(event: MouseEvent, favorite: Favorite) {
    event.preventDefault();
    event.stopPropagation();
    menuId = '';
    onDelete(favorite);
  }
</script>

<svelte:window
  onclick={() => (menuId = '')}
  onkeydown={(event) => { if (event.key === 'Escape') menuId = ''; }}
/>

<section class:show-names={showNames} class="favorites-panel" aria-labelledby="favorites-heading">
  <h2 id="favorites-heading" class="visually-hidden">Favoriler</h2>
  <div class="favorite-grid">
    {#each visibleFavorites as favorite (favorite.id)}
        <div class="favorite-entry">
          <a class="favorite-item" href={favorite.url} aria-label={`${favorite.name} sitesini aç`}>
            <span class="favorite-tile">
              <Favicon url={favorite.url} requestSize={64} iconSize={20} />
            </span>
            {#if showNames}<span class="favorite-name">{favorite.name}</span>{/if}
          </a>

          <IconButton
            label={`${favorite.name} seçenekleri`}
            class={menuId === favorite.id ? 'favorite-menu-trigger active' : 'favorite-menu-trigger'}
            aria-expanded={menuId === favorite.id}
            aria-haspopup="menu"
            onclick={(event: MouseEvent) => toggleMenu(event, favorite.id)}
          >
            <Icon name="more" size={15} />
          </IconButton>

          {#if menuId === favorite.id}
            <div class="context-menu" role="menu" aria-label={`${favorite.name} yönetimi`}>
              <Button variant="unstyled" role="menuitem" onclick={(event: MouseEvent) => edit(event, favorite)}>
                <Icon name="edit" size={14} /> Düzenle
              </Button>
              <Button variant="unstyled" role="menuitem" onclick={(event: MouseEvent) => remove(event, favorite)}>
                <Icon name="close" size={14} /> Sil
              </Button>
            </div>
          {/if}
        </div>
      {/each}

    <Button
      variant="unstyled"
      class="favorite-item favorite-add"
      onclick={onAdd}
      disabled={favorites.length >= 15}
      aria-label="Favori ekle"
      title={favorites.length >= 15 ? 'Favori sınırına ulaştın' : 'Favori ekle'}
    >
      <span class="favorite-tile"><Icon name="plus" size={22} /></span>
      {#if showNames}<span class="favorite-name">Ekle</span>{/if}
    </Button>
  </div>
</section>

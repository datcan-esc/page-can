<script lang="ts">
  import { FAVORITE_CARD_LIMIT } from '../../lib/display-limits';
  import type { Favorite, FavoriteFolder } from '../../lib/types';
  import Card from '../ui/Card.svelte';
  import AppTile from './AppTile.svelte';
  import './favorites.css';

  export let favorites: Favorite[] = [];
  export let showNames = true;
  export let showShortcutHints = false;
  export let onAdd: () => void;
  export let onOpenFolder: (folder: FavoriteFolder) => void;
  export let onEdit: (favorite: Favorite) => void;
  export let onDelete: (favorite: Favorite) => void;

  let menuId = '';

  $: visibleFavorites = favorites.slice(0, FAVORITE_CARD_LIMIT);

  function toggleMenu(id: string) {
    menuId = menuId === id ? '' : id;
  }
</script>

<svelte:window
  onclick={() => (menuId = '')}
  onkeydown={(event) => { if (event.key === 'Escape') menuId = ''; }}
/>

<Card
  ariaLabel="Favoriler"
  class={showNames ? 'favorites-card show-names' : 'favorites-card'}
>
  <div class="favorite-grid">
    {#each visibleFavorites as favorite (favorite.id)}
      <AppTile
        variant={favorite.kind}
        name={favorite.name}
        url={favorite.kind === 'site' ? favorite.url : ''}
        apps={favorite.kind === 'folder' ? favorite.apps : []}
        shortcut={favorite.shortcut}
        showShortcutHint={showShortcutHints}
        showName={showNames}
        menuEnabled
        menuOpen={menuId === favorite.id}
        onActivate={() => { if (favorite.kind === 'folder') onOpenFolder(favorite); }}
        onMenuToggle={() => toggleMenu(favorite.id)}
        onEdit={() => { menuId = ''; onEdit(favorite); }}
        onDelete={() => { menuId = ''; onDelete(favorite); }}
      />
    {/each}

    <AppTile
      variant="add"
      name="Ekle"
      ariaLabel="Favori ekle"
      showName={showNames}
      disabled={favorites.length >= FAVORITE_CARD_LIMIT}
      onActivate={onAdd}
    />
  </div>
</Card>

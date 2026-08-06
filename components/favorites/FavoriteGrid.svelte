<script lang="ts">
  import type { Favorite } from '../../lib/types';
  import Card from '../ui/Card.svelte';
  import FavoriteAddTile from './FavoriteAddTile.svelte';
  import FavoriteTile from './FavoriteTile.svelte';
  import './favorites.css';

  export let favorites: Favorite[] = [];
  export let showNames = true;
  export let onAdd: () => void;
  export let onEdit: (favorite: Favorite) => void;
  export let onDelete: (favorite: Favorite) => void;

  let menuId = '';

  $: visibleFavorites = favorites.slice(0, 15);

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
      <FavoriteTile
        {favorite}
        showName={showNames}
        menuOpen={menuId === favorite.id}
        onMenuToggle={toggleMenu}
        onEdit={(item) => { menuId = ''; onEdit(item); }}
        onDelete={(item) => { menuId = ''; onDelete(item); }}
      />
    {/each}

    <FavoriteAddTile showName={showNames} disabled={favorites.length >= 15} {onAdd} />
  </div>
</Card>

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
  export let onReorder: (sourceId: string, targetId: string) => void;

  let menuId = '';
  let draggedId = '';
  let dropTargetId = '';
  let activationDisabled = false;

  $: visibleFavorites = favorites.slice(0, FAVORITE_CARD_LIMIT);

  function toggleMenu(id: string) {
    menuId = menuId === id ? '' : id;
  }

  function startDragging(id: string) {
    menuId = '';
    draggedId = id;
    dropTargetId = '';
    activationDisabled = true;
  }

  function enterDragTarget(id: string) {
    if (!draggedId) return;
    dropTargetId = id === draggedId ? '' : id;
  }

  function finishDragging() {
    draggedId = '';
    dropTargetId = '';
    window.setTimeout(() => { activationDisabled = false; }, 0);
  }

  function dropOn(id: string) {
    const sourceId = draggedId;
    finishDragging();
    if (sourceId && sourceId !== id) onReorder(sourceId, id);
  }

  function moveAdjacent(id: string, offset: -1 | 1) {
    const index = visibleFavorites.findIndex((favorite) => favorite.id === id);
    const target = visibleFavorites[index + offset];
    menuId = '';
    if (target) onReorder(id, target.id);
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
    {#each visibleFavorites as favorite, index (favorite.id)}
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
        reorderable={visibleFavorites.length > 1}
        dragging={draggedId === favorite.id}
        dropTarget={dropTargetId === favorite.id}
        {activationDisabled}
        canMovePrevious={index > 0}
        canMoveNext={index < visibleFavorites.length - 1}
        onActivate={() => { if (favorite.kind === 'folder') onOpenFolder(favorite); }}
        onMenuToggle={() => toggleMenu(favorite.id)}
        onMovePrevious={() => moveAdjacent(favorite.id, -1)}
        onMoveNext={() => moveAdjacent(favorite.id, 1)}
        onDragStart={() => startDragging(favorite.id)}
        onDragEnter={() => enterDragTarget(favorite.id)}
        onDrop={() => dropOn(favorite.id)}
        onDragEnd={finishDragging}
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

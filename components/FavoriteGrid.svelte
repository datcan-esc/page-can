<script lang="ts">
  import type { Favorite } from '../lib/types';
  import { faviconUrl } from '../lib/utils';
  import BaseCard from './BaseCard.svelte';
  import Icon from './Icon.svelte';

  export let favorites: Favorite[] = [];
  export let onAdd: () => void;
  export let onEdit: (favorite: Favorite) => void;
  export let onDelete: (favorite: Favorite) => void;

  let menuId = '';

  $: visibleFavorites = favorites.slice(0, 15);

  const initials = (name: string) => name.trim().slice(0, 2).toLocaleUpperCase('tr-TR');

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

<svelte:window onclick={() => (menuId = '')} />

<BaseCard title="Favoriler" headingId="favorites-heading" class="favorites-card">
  <div class="favorite-grid">
    {#each visibleFavorites as favorite (favorite.id)}
      <div class="favorite-entry">
        <a class="favorite-item" href={favorite.url} aria-label={`${favorite.name} sitesini aç`}>
          <span class="favorite-tile">
            <span class="favorite-fallback">{initials(favorite.name)}</span>
            <img
              src={faviconUrl(favorite.url)}
              alt=""
              onerror={(event) => ((event.currentTarget as HTMLImageElement).style.display = 'none')}
            />
          </span>
          <span class="favorite-name">{favorite.name}</span>
        </a>

        <button
          class="favorite-menu-trigger"
          class:active={menuId === favorite.id}
          type="button"
          aria-label={`${favorite.name} seçenekleri`}
          aria-expanded={menuId === favorite.id}
          onclick={(event) => toggleMenu(event, favorite.id)}
        >
          <Icon name="more" size={16} />
        </button>

        {#if menuId === favorite.id}
          <div class="context-menu" role="group" aria-label={`${favorite.name} yönetimi`}>
            <button type="button" role="menuitem" onclick={(event) => edit(event, favorite)}>
              <Icon name="edit" size={14} /> Düzenle
            </button>
            <button class="danger" type="button" role="menuitem" onclick={(event) => remove(event, favorite)}>
              <Icon name="trash" size={14} /> Sil
            </button>
          </div>
        {/if}
      </div>
    {/each}

    <button
      class="favorite-item favorite-add"
      type="button"
      onclick={onAdd}
      disabled={favorites.length >= 15}
      title={favorites.length >= 15 ? 'En fazla 15 favori eklenebilir' : 'Favori ekle'}
    >
      <span class="favorite-tile"><Icon name="plus" size={22} /></span>
      <span class="favorite-name">Ekle</span>
    </button>
  </div>
</BaseCard>

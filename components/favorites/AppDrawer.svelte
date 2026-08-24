<script lang="ts">
  import { onMount } from 'svelte';
  import { FOLDER_APP_LIMIT } from '../../lib/display-limits';
  import type { FavoriteFolder, FolderApp } from '../../lib/types';
  import { numberShortcutIndex } from '../../lib/utils';
  import Card from '../ui/Card.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import AppTile from './AppTile.svelte';
  import './favorites.css';

  export let folder: FavoriteFolder;
  export let showNames = true;
  export let showShortcutHints = false;
  export let suspended = false;
  export let onClose: () => void;
  export let onAdd: () => void;
  export let onEdit: (app: FolderApp) => void;
  export let onDelete: (app: FolderApp) => void;

  let layer: HTMLElement;
  let menuId = '';
  const focusableSelector = 'button:not([disabled]), a[href]';

  onMount(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    window.requestAnimationFrame(() => {
      layer.querySelector<HTMLElement>('[data-drawer-focus]')?.focus();
    });
    return () => previouslyFocused?.focus();
  });

  function handleLayerClick(event: MouseEvent) {
    if (!suspended && event.target === event.currentTarget) onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (suspended) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (menuId) {
        menuId = '';
        return;
      }
      onClose();
      return;
    }

    const target = event.target as HTMLElement | null;
    const shortcutIndex = numberShortcutIndex(event);
    if (
      shortcutIndex !== null
      && !target?.closest('input, textarea, select, [role="textbox"]')
      && !target?.isContentEditable
    ) {
      const app = folder.apps[shortcutIndex];
      if (app) {
        event.preventDefault();
        window.location.assign(app.url);
      }
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = [...layer.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter((element) => element.offsetParent !== null);
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function toggleMenu(id: string) {
    menuId = menuId === id ? '' : id;
  }
</script>

<svelte:window
  onclick={() => { if (!suspended) menuId = ''; }}
  onkeydown={handleKeydown}
/>

<div
  bind:this={layer}
  class="app-drawer-layer"
  class:suspended
  role="dialog"
  aria-modal={suspended ? undefined : 'true'}
  aria-hidden={suspended ? 'true' : undefined}
  aria-label={`${folder.name} uygulama çekmecesi`}
  onclick={handleLayerClick}
>
  <Card title={folder.name} class="app-drawer-card">
    <svelte:fragment slot="action">
      <IconButton label="Uygulama çekmecesini kapat" variant="ghost" onclick={onClose}>
        <Icon name="close" size={17} />
      </IconButton>
    </svelte:fragment>

    <div class="app-drawer-grid" aria-label={`${folder.name} uygulamaları`}>
      {#each folder.apps as app, index (app.id)}
        <AppTile
          variant="site"
          name={app.name}
          url={app.url}
          shortcut={String(index + 1)}
          showShortcutHint={showShortcutHints}
          showName={showNames}
          menuEnabled
          menuOpen={menuId === app.id}
          focusOnOpen={index === 0}
          onMenuToggle={() => toggleMenu(app.id)}
          onEdit={() => { menuId = ''; onEdit(app); }}
          onDelete={() => { menuId = ''; onDelete(app); }}
        />
      {/each}

      {#if folder.apps.length < FOLDER_APP_LIMIT}
        <AppTile
          variant="add"
          name="Ekle"
          ariaLabel={`${folder.name} klasörüne uygulama ekle`}
          showName={showNames}
          focusOnOpen={folder.apps.length === 0}
          onActivate={onAdd}
        />
      {/if}
    </div>
  </Card>
</div>

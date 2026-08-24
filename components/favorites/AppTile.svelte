<script context="module" lang="ts">
  export type AppTileVariant = 'site' | 'folder' | 'add';
</script>

<script lang="ts">
  import type { FolderApp } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  import Favicon from '../ui/Favicon.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import ShortcutHint from '../ui/ShortcutHint.svelte';
  import FolderPreview from './FolderPreview.svelte';
  import './favorites.css';

  export let variant: AppTileVariant;
  export let name: string;
  export let url = '';
  export let apps: FolderApp[] = [];
  export let ariaLabel = '';
  export let title = '';
  export let shortcut = '';
  export let showShortcutHint = false;
  export let showName = true;
  export let disabled = false;
  export let menuEnabled = false;
  export let menuOpen = false;
  export let focusOnOpen = false;
  export let onActivate: () => void = () => undefined;
  export let onMenuToggle: () => void = () => undefined;
  export let onEdit: () => void = () => undefined;
  export let onDelete: () => void = () => undefined;

  $: accessibleName = variant === 'folder'
    ? `${name} uygulama klasörünü aç`
    : variant === 'add'
      ? name
      : `${name} sitesini aç`;

  function toggleMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onMenuToggle();
  }

  function edit(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onEdit();
  }

  function remove(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onDelete();
  }
</script>

<div
  class:show-name={showName}
  class:app-tile-entry--menu-open={menuOpen}
  class="app-tile-entry app-tile-entry--{variant}"
>
  {#if variant === 'site'}
    <a
      class="app-tile app-tile--site"
      href={url}
      aria-label={ariaLabel || accessibleName}
      title={title || undefined}
      data-drawer-focus={focusOnOpen ? '' : undefined}
    >
      <span class="app-tile__icon">
        <Favicon {url} requestSize={64} iconSize={22} />
      </span>
      {#if showName}<span class="app-tile__name">{name}</span>{/if}
    </a>
  {:else}
    <button
      type="button"
      class="app-tile app-tile--{variant}"
      onclick={onActivate}
      {disabled}
      aria-label={ariaLabel || accessibleName}
      title={title || (disabled ? 'Favori sınırına ulaştın' : undefined)}
      data-drawer-focus={focusOnOpen ? '' : undefined}
    >
      <span class="app-tile__icon">
        {#if variant === 'folder'}
          <FolderPreview {apps} />
        {:else}
          <Icon name="plus" size={22} />
        {/if}
      </span>
      {#if showName}<span class="app-tile__name">{name}</span>{/if}
    </button>
  {/if}

  <ShortcutHint
    {shortcut}
    visible={showShortcutHint}
    class="app-tile__shortcut-hint"
  />

  {#if menuEnabled}
    <IconButton
      label={`${name} seçenekleri`}
      variant="ghost"
      class={menuOpen ? 'app-tile__menu-trigger active' : 'app-tile__menu-trigger'}
      aria-expanded={menuOpen}
      aria-haspopup="menu"
      onclick={toggleMenu}
    >
      <Icon name="more" size={16} />
    </IconButton>

    {#if menuOpen}
      <div class="app-tile-menu" role="menu" aria-label={`${name} yönetimi`}>
        <Button variant="ghost" role="menuitem" onclick={edit}>
          <Icon name="edit" size={14} /> Düzenle
        </Button>
        <Button variant="ghost" role="menuitem" class="app-tile-menu__delete" onclick={remove}>
          <Icon name="trash" size={14} /> Sil
        </Button>
      </div>
    {/if}
  {/if}
</div>

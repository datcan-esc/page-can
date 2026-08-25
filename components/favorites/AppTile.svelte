<script context="module" lang="ts">
  export type AppTileVariant = 'site' | 'folder' | 'add';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
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
  export let reorderable = false;
  export let dragging = false;
  export let dropTarget = false;
  export let activationDisabled = false;
  export let canMovePrevious = false;
  export let canMoveNext = false;
  export let onActivate: () => void = () => undefined;
  export let onMenuToggle: () => void = () => undefined;
  export let onEdit: () => void = () => undefined;
  export let onDelete: () => void = () => undefined;
  export let onMovePrevious: () => void = () => undefined;
  export let onMoveNext: () => void = () => undefined;
  export let onDragStart: () => void = () => undefined;
  export let onDragEnter: () => void = () => undefined;
  export let onDrop: () => void = () => undefined;
  export let onDragEnd: () => void = () => undefined;

  let dragPreview: HTMLElement | null = null;
  let dragPreviewFrame: number | null = null;

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

  function activate(event: MouseEvent) {
    if (activationDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (variant !== 'site') onActivate();
  }

  function movePrevious(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onMovePrevious();
  }

  function moveNext(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onMoveNext();
  }

  function removeDragPreview() {
    if (dragPreviewFrame !== null) window.cancelAnimationFrame(dragPreviewFrame);
    dragPreviewFrame = null;
    dragPreview?.remove();
    dragPreview = null;
  }

  function setDragPreview(event: DragEvent) {
    if (!event.dataTransfer || !(event.currentTarget instanceof HTMLElement)) return;

    removeDragPreview();
    const source = event.currentTarget;
    const rect = source.getBoundingClientRect();
    const preview = source.cloneNode(true) as HTMLElement;
    preview.classList.remove(
      'app-tile-entry--dragging',
      'app-tile-entry--drop-target',
      'app-tile-entry--menu-open',
    );
    preview.classList.add('app-tile-drag-preview');
    preview.removeAttribute('draggable');
    preview.setAttribute('aria-hidden', 'true');
    preview.inert = true;
    preview.querySelectorAll(
      '.app-tile__menu-trigger, .app-tile-menu, .app-tile__shortcut-hint',
    ).forEach((element) => element.remove());
    preview.style.width = `${rect.width}px`;
    preview.style.height = `${rect.height}px`;
    preview.style.left = `${rect.left}px`;
    preview.style.top = `${rect.top}px`;

    const computedStyle = window.getComputedStyle(source);
    for (const property of [
      '--text',
      '--muted',
      '--surface-soft',
      '--surface-hover',
      '--separator',
    ]) {
      preview.style.setProperty(property, computedStyle.getPropertyValue(property));
    }

    document.body.append(preview);
    dragPreview = preview;
    void preview.offsetWidth;
    const offsetX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    event.dataTransfer.setDragImage(preview, offsetX, offsetY);
    dragPreviewFrame = window.requestAnimationFrame(() => {
      if (dragPreview === preview) {
        preview.style.left = '-240px';
        preview.style.top = '-240px';
      }
      dragPreviewFrame = null;
    });
  }

  function startDragging(event: DragEvent) {
    const target = event.target as HTMLElement | null;
    if (!reorderable || target?.closest('.app-tile__menu-trigger, .app-tile-menu')) {
      event.preventDefault();
      return;
    }
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', name);
      setDragPreview(event);
    }
    onDragStart();
  }

  function enterDragTarget(event: DragEvent) {
    if (!reorderable) return;
    event.preventDefault();
    onDragEnter();
  }

  function allowDrop(event: DragEvent) {
    if (!reorderable) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  function drop(event: DragEvent) {
    if (!reorderable) return;
    event.preventDefault();
    event.stopPropagation();
    onDrop();
  }

  function finishDragging() {
    removeDragPreview();
    onDragEnd();
  }

  onDestroy(removeDragPreview);
</script>

<div
  class:show-name={showName}
  class:app-tile-entry--menu-open={menuOpen}
  class:app-tile-entry--reorderable={reorderable}
  class:app-tile-entry--dragging={dragging}
  class:app-tile-entry--drop-target={dropTarget}
  class="app-tile-entry app-tile-entry--{variant}"
  role="group"
  draggable={reorderable}
  ondragstart={startDragging}
  ondragenter={enterDragTarget}
  ondragover={allowDrop}
  ondrop={drop}
  ondragend={finishDragging}
>
  {#if variant === 'site'}
    <a
      class="app-tile app-tile--site"
      href={url}
      aria-label={ariaLabel || accessibleName}
      title={title || undefined}
      data-drawer-focus={focusOnOpen ? '' : undefined}
      onclick={activate}
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
      onclick={activate}
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
        {#if reorderable}
          <Button
            variant="ghost"
            role="menuitem"
            disabled={!canMovePrevious}
            onclick={movePrevious}
          >
            <Icon name="arrow-left" size={14} /> Bir önceye taşı
          </Button>
          <Button
            variant="ghost"
            role="menuitem"
            disabled={!canMoveNext}
            onclick={moveNext}
          >
            <Icon name="arrow-right" size={14} /> Bir sonraya taşı
          </Button>
        {/if}
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

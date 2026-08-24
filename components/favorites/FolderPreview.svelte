<script lang="ts">
  import type { FolderApp } from '../../lib/types';
  import Favicon from '../ui/Favicon.svelte';
  import Icon from '../ui/Icon.svelte';

  export let apps: FolderApp[] = [];

  $: previewApps = Array.from(
    { length: 9 },
    (_, index): FolderApp | null => apps[index] ?? null,
  );
</script>

{#if apps.length}
  <span class="app-folder-preview" aria-hidden="true">
    {#each previewApps as app}
      <span class:filled={Boolean(app)} class="app-folder-preview__slot">
        {#if app}<Favicon url={app.url} requestSize={32} iconSize={10} />{/if}
      </span>
    {/each}
  </span>
{:else}
  <Icon name="grid" size={24} />
{/if}

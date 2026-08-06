<script lang="ts">
  import { faviconUrl } from '../../lib/utils';
  import Icon from './Icon.svelte';

  export let url: string;
  export let requestSize = 64;
  export let iconSize = 17;

  let failed = false;
  let previousUrl = url;

  $: if (url !== previousUrl) {
    previousUrl = url;
    failed = false;
  }
</script>

{#if failed}
  <Icon name="globe" size={iconSize} />
{:else}
  <img src={faviconUrl(url, requestSize)} alt="" onerror={() => (failed = true)} />
{/if}

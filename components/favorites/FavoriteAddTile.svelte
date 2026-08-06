<script lang="ts">
  import Button from '../ui/Button.svelte';
  import Icon from '../ui/Icon.svelte';
  import './favorites.css';

  export let showName = true;
  export let disabled = false;
  export let onAdd: () => void;
</script>

<Button
  variant="outlined"
  class="favorite-item favorite-add"
  onclick={onAdd}
  {disabled}
  aria-label="Favori ekle"
  title={disabled ? 'Favori sınırına ulaştın' : 'Favori ekle'}
>
  <span class="favorite-tile"><Icon name="plus" size={22} /></span>
  {#if showName}<span class="favorite-name">Ekle</span>{/if}
</Button>

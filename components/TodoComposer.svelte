<script lang="ts">
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';

  export let onAdd: (title: string) => void;
  export let placeholder = 'Bir görev ekle';

  let value = '';

  function submit() {
    const title = value.trim();
    if (!title) return;
    onAdd(title);
    value = '';
  }
</script>

<form class="todo-add" onsubmit={(event) => { event.preventDefault(); submit(); }}>
  <span aria-hidden="true"><Icon name="plus" size={16} /></span>
  <input bind:value maxlength="160" {placeholder} aria-label="Yeni yapılacak" />
  <IconButton label="Görevi ekle" variant="primary" type="submit" class="todo-submit" disabled={!value.trim()}>
    <Icon name="arrow-up" size={15} strokeWidth={2.2} />
  </IconButton>
</form>

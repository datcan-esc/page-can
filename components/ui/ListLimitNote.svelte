<script lang="ts">
  import './list.css';

  export let text: string;
  export let onShowAll: () => void;
</script>

<div class="list-limit-note" role="note">
  <span>{text}</span>
  <button type="button" class="list-limit-note__action" onclick={onShowAll}>Tümü</button>
</div>

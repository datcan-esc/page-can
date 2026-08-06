<script lang="ts">
  import Card from '../ui/Card.svelte';
  import './shell.css';

  export let time: string;
  export let date: string;
</script>

<Card ariaLabel={`${time}, ${date}`} class="clock-card">
  <time class="clock-card__time">{time}</time>
  <span class="clock-card__divider" aria-hidden="true"></span>
  <time class="clock-card__date">{date}</time>
</Card>

<script lang="ts">
  export let time: string;
  export let date: string;
</script>

<section class="clock-card" aria-label={`${time}, ${date}`}>
  <time class="clock-card__time">{time}</time>
  <span class="clock-card__divider" aria-hidden="true"></span>
  <time class="clock-card__date">{date}</time>
</section>

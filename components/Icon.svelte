<script lang="ts">
  import {
    ArrowUp,
    Bookmark,
    ChartNoAxesColumnIncreasing,
    Check,
    ChevronRight,
    CircleCheckBig,
    Ellipsis,
    ExternalLink,
    Focus,
    Globe,
    Image,
    Keyboard,
    LayoutGrid,
    ListTodo,
    Pause,
    Pencil,
    Play,
    Plus,
    RotateCcw,
    Search,
    Settings,
    SlidersHorizontal,
    Sparkles,
    Timer,
    X,
  } from '@lucide/svelte';

  export let name: string;
  export let size = 20;
  export let strokeWidth = 1.8;

  const icons = {
    settings: Settings,
    sliders: SlidersHorizontal,
    plus: Plus,
    arrow: ChevronRight,
    'arrow-up': ArrowUp,
    play: Play,
    pause: Pause,
    reset: RotateCcw,
    check: Check,
    'check-circle': CircleCheckBig,
    edit: Pencil,
    close: X,
    search: Search,
    image: Image,
    keyboard: Keyboard,
    bookmark: Bookmark,
    more: Ellipsis,
    external: ExternalLink,
    timer: Timer,
    focus: Focus,
    globe: Globe,
    list: ListTodo,
    grid: LayoutGrid,
    chart: ChartNoAxesColumnIncreasing,
    sparkles: Sparkles,
  } as const;

  $: IconComponent = icons[name as keyof typeof icons] ?? Sparkles;
</script>

<svelte:component
  this={IconComponent}
  {size}
  {strokeWidth}
  aria-hidden="true"
/>

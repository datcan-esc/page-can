<script lang="ts">
  import {
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Bookmark,
    ChartNoAxesColumnIncreasing,
    Check,
    ChevronRight,
    CircleCheckBig,
    Copy,
    EllipsisVertical,
    ExternalLink,
    Focus,
    Globe,
    Image,
    Keyboard,
    LayoutGrid,
    ListTodo,
    Music2,
    Pause,
    Pencil,
    Play,
    Plus,
    RotateCcw,
    Search,
    Settings,
    SkipBack,
    SkipForward,
    SlidersHorizontal,
    Sparkles,
    Square,
    Tag,
    Timer,
    Trash2,
    Type,
    X,
  } from '@lucide/svelte';

  export let name: string;
  export let size = 20;
  export let strokeWidth = 1.8;
  export let filled = false;

  const icons = {
    settings: Settings,
    sliders: SlidersHorizontal,
    plus: Plus,
    arrow: ChevronRight,
    'arrow-left': ArrowLeft,
    'arrow-right': ArrowRight,
    'arrow-up': ArrowUp,
    play: Play,
    pause: Pause,
    stop: Square,
    reset: RotateCcw,
    check: Check,
    'check-circle': CircleCheckBig,
    copy: Copy,
    edit: Pencil,
    close: X,
    search: Search,
    image: Image,
    keyboard: Keyboard,
    bookmark: Bookmark,
    more: EllipsisVertical,
    external: ExternalLink,
    timer: Timer,
    focus: Focus,
    globe: Globe,
    list: ListTodo,
    grid: LayoutGrid,
    chart: ChartNoAxesColumnIncreasing,
    sparkles: Sparkles,
    tag: Tag,
    trash: Trash2,
    text: Type,
    music: Music2,
    previous: SkipBack,
    next: SkipForward,
  } as const;

  $: IconComponent = icons[name as keyof typeof icons] ?? Sparkles;
</script>

{#if filled && name === 'play'}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M8.1 5.12c0-1.04 1.17-1.65 2.02-1.04l9.28 6.78a1.4 1.4 0 0 1 0 2.28l-9.28 6.78c-.85.61-2.02 0-2.02-1.04V5.12Z" />
  </svg>
{:else if filled && name === 'pause'}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <rect x="6.75" y="4.75" width="4" height="14.5" rx="1.25" />
    <rect x="13.25" y="4.75" width="4" height="14.5" rx="1.25" />
  </svg>
{:else if filled && name === 'stop'}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <rect x="5" y="5" width="14" height="14" rx="2.25" />
  </svg>
{:else if filled && name === 'previous'}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <rect x="4.5" y="5" width="3" height="14" rx="1.15" />
    <path d="M18.25 5.36c.83-.58 1.97.02 1.97 1.04v11.2c0 1.02-1.14 1.62-1.97 1.04l-8.03-5.6a1.27 1.27 0 0 1 0-2.08l8.03-5.6Z" />
  </svg>
{:else if filled && name === 'next'}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M5.75 5.36c-.83-.58-1.97.02-1.97 1.04v11.2c0 1.02 1.14 1.62 1.97 1.04l8.03-5.6a1.27 1.27 0 0 0 0-2.08l-8.03-5.6Z" />
    <rect x="16.5" y="5" width="3" height="14" rx="1.15" />
  </svg>
{:else}
  <svelte:component
    this={IconComponent}
    {size}
    {strokeWidth}
    aria-hidden="true"
  />
{/if}

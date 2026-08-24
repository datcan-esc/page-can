<script context="module" lang="ts">
  export interface ChoiceOption {
    value: string;
    label: string;
    description?: string;
    icon: string;
  }
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import './choice-picker.css';

  export let value: string;
  export let options: ChoiceOption[];
  export let label: string;
  export let onChange: (value: string) => void;
</script>

<fieldset class="choice-picker">
  <legend>{label}</legend>
  <div class="choice-picker__options">
    {#each options as option (option.value)}
      <button
        type="button"
        class:active={value === option.value}
        class="choice-picker__option"
        aria-pressed={value === option.value}
        onclick={() => onChange(option.value)}
      >
        <span class="choice-picker__icon"><Icon name={option.icon} size={18} /></span>
        <span class="choice-picker__copy">
          <strong>{option.label}</strong>
          {#if option.description}<small>{option.description}</small>{/if}
        </span>
        <span class="choice-picker__status" aria-hidden="true">
          {#if value === option.value}<Icon name="check" size={12} strokeWidth={2.4} />{/if}
        </span>
      </button>
    {/each}
  </div>
</fieldset>

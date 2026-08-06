<script context="module" lang="ts">
  export type InputType = 'text' | 'search' | 'url' | 'email' | 'password' | 'number';
</script>

<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { createId } from '../../lib/utils';
  import Icon from './Icon.svelte';
  import './input.css';

  export let value: string | number = '';
  export let type: InputType = 'text';
  export let label = '';
  export let description = '';
  export let icon = '';
  export let suffix = '';
  export let placeholder = '';
  export let multiline = false;
  export let rows = 3;
  export let disabled = false;
  export let required = false;
  export let readonly = false;
  export let name = '';
  export let autocomplete: HTMLInputAttributes['autocomplete'] = undefined;
  export let inputmode: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url' | undefined = undefined;
  export let min: string | number | undefined = undefined;
  export let max: string | number | undefined = undefined;
  export let step: string | number | undefined = undefined;
  export let maxLength: number | undefined = undefined;
  export let onInput: ((event: Event) => void) | undefined = undefined;
  export let id = createId('input');

  let inputElement: HTMLInputElement;
  let textareaElement: HTMLTextAreaElement;
  let className = '';
  export { className as class };

  export function focus() {
    (multiline ? textareaElement : inputElement)?.focus();
  }

  export function select() {
    (multiline ? textareaElement : inputElement)?.select();
  }
</script>

<div
  class:input-field--multiline={multiline}
  class:input-field--disabled={disabled}
  class={`input-field ${className}`.trim()}
>
  {#if label}<label class="input-field__label" for={id}>{label}</label>{/if}

  <div class="input-control">
    {#if icon}
      <span class="input-control__icon" aria-hidden="true"><Icon name={icon} size={16} /></span>
    {/if}

    {#if multiline}
      <textarea
        {...$$restProps}
        bind:this={textareaElement}
        bind:value
        {id}
        {rows}
        {placeholder}
        {disabled}
        {required}
        {name}
        maxlength={maxLength}
        readonly={readonly}
        oninput={onInput}
      ></textarea>
    {:else}
      <input
        {...$$restProps}
        bind:this={inputElement}
        bind:value
        {id}
        {type}
        {placeholder}
        {disabled}
        {required}
        {name}
        {min}
        {max}
        {step}
        {inputmode}
        maxlength={maxLength}
        readonly={readonly}
        {autocomplete}
        oninput={onInput}
      />
    {/if}

    {#if suffix}<span class="input-control__suffix">{suffix}</span>{/if}
    {#if $$slots.trailing}<div class="input-control__trailing"><slot name="trailing" /></div>{/if}
  </div>

  {#if description}<small class="input-field__description">{description}</small>{/if}
</div>

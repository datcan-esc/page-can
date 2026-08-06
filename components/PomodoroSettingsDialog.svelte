<script lang="ts">
  import type { PomodoroPreferences } from '../lib/types';
  import BaseDialog from './BaseDialog.svelte';
  import Button from './Button.svelte';
  import ShortcutInput from './ShortcutInput.svelte';

  export let preferences: PomodoroPreferences;
  export let favoriteShortcuts: string[] = [];
  export let onClose: () => void;
  export let onSave: (preferences: PomodoroPreferences) => Promise<void>;

  let draft = structuredClone(preferences);
  let error = '';
  let saving = false;

  async function submit() {
    error = '';
    if (draft.shortcut && favoriteShortcuts.includes(draft.shortcut)) {
      error = 'Bu kısayol bir favoride kullanılıyor.';
      return;
    }

    saving = true;
    await onSave(draft);
    saving = false;
    onClose();
  }
</script>

<BaseDialog title="Odak ayarları" {onClose}>
  <form id="pomodoro-form" class="dialog-form" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
    <label class="field-group focus-duration-field">
      <span>Geri sayım süresi</span>
      <span class="number-input-wrap">
        <input type="number" min="1" max="240" bind:value={draft.focusMinutes} />
        <small>dakika</small>
      </span>
    </label>

    <ShortcutInput value={draft.shortcut} onChange={(value) => (draft.shortcut = value)} label="Başlat / duraklat" />
    <p class="field-hint">Tek harf, Space veya tuş kombinasyonu kullanabilirsin.</p>
    {#if error}<p class="form-error">{error}</p>{/if}
  </form>

  <svelte:fragment slot="footer">
    <Button variant="secondary" onclick={onClose}>Vazgeç</Button>
    <span class="footer-spacer"></span>
    <Button variant="primary" type="submit" form="pomodoro-form" disabled={saving}>
      {saving ? 'Kaydediliyor…' : 'Kaydet'}
    </Button>
  </svelte:fragment>
</BaseDialog>

<script lang="ts">
  import type { PomodoroPreferences } from '../lib/types';
  import BaseDialog from './BaseDialog.svelte';
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
      error = 'Bu klavye kısayolu bir favoride kullanılıyor.';
      return;
    }

    saving = true;
    await onSave(draft);
    saving = false;
    onClose();
  }
</script>

<BaseDialog title="Pomodoro ayarları" {onClose}>
  <form id="pomodoro-form" class="dialog-form" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
    <div class="number-grid">
      <label><span>Odak</span><input type="number" min="1" max="120" bind:value={draft.focusMinutes} /><small>dk</small></label>
      <label><span>Kısa mola</span><input type="number" min="1" max="60" bind:value={draft.shortBreakMinutes} /><small>dk</small></label>
      <label><span>Uzun mola</span><input type="number" min="1" max="90" bind:value={draft.longBreakMinutes} /><small>dk</small></label>
    </div>

    <label class="toggle-row">
      <span><b>Molaları otomatik başlat</b><small>Odak seansı bitince mola başlar.</small></span>
      <input type="checkbox" bind:checked={draft.autoStartBreaks} />
    </label>
    <label class="toggle-row">
      <span><b>Odağı otomatik başlat</b><small>Mola bitince yeni seans başlar.</small></span>
      <input type="checkbox" bind:checked={draft.autoStartFocus} />
    </label>

    <ShortcutInput value={draft.shortcut} onChange={(value) => (draft.shortcut = value)} label="Başlat / duraklat" />
    {#if error}<p class="form-error">{error}</p>{/if}
  </form>

  <svelte:fragment slot="footer">
    <button class="secondary-button" type="button" onclick={onClose}>Vazgeç</button>
    <span class="footer-spacer"></span>
    <button class="primary-button" type="submit" form="pomodoro-form" disabled={saving}>
      {saving ? 'Kaydediliyor…' : 'Kaydet'}
    </button>
  </svelte:fragment>
</BaseDialog>

<script lang="ts">
  import type { MediaPreferences } from '../../lib/types';
  import Dialog from '../ui/Dialog.svelte';
  import ShortcutField from '../ui/ShortcutField.svelte';
  import '../ui/form.css';

  export let preferences: MediaPreferences;
  export let reservedShortcuts: string[] = [];
  export let onClose: () => void;
  export let onSave: (preferences: MediaPreferences) => Promise<void>;

  let draft = structuredClone(preferences);
  let error = '';
  let saving = false;

  async function submit() {
    error = '';
    if (draft.shortcut && reservedShortcuts.includes(draft.shortcut)) {
      error = 'Bu klavye kısayolu zaten kullanılıyor.';
      return;
    }

    saving = true;
    try {
      await onSave({ ...draft });
      onClose();
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Medya ayarları kaydedilemedi.';
    } finally {
      saving = false;
    }
  }
</script>

<Dialog
  title="Medya ayarları"
  subtitle="Klavye kısayolu"
  {onClose}
  onCancel={onClose}
  formId="media-settings-form"
  confirmLabel="Kaydet"
  {saving}
>
  <form id="media-settings-form" class="dialog-form" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
    <ShortcutField
      value={draft.shortcut}
      onChange={(value) => (draft.shortcut = value)}
      label="Oynat / duraklat"
      description="Yeni sekme açıkken YouTube veya YouTube Music oynatıcısını kontrol eder."
    />
    {#if error}<p class="form-error">{error}</p>{/if}
  </form>
</Dialog>
